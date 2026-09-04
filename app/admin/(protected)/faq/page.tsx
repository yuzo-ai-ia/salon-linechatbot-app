// FAQ 一覧。カテゴリごとにグルーピングして表示する。
// 各行はタップで編集画面へ（一覧から直接削除はできない設計。誤操作防止のため
// 削除は編集画面 → 専用の確認画面、という二段構えにしている）。

import Link from "next/link";
import { requireAdminSession } from "@/lib/admin/guard";
import { listFaqs, type FaqAdminRow } from "@/lib/faq/admin";
import { FAQ_CATEGORIES, FAQ_CATEGORY_LABEL } from "@/lib/faq/categories";

export default async function FaqListPage(props: PageProps<"/admin/faq">) {
  // proxy.ts でもガードしているが、Server Action は直接POSTでも呼び出せる
  // （＝ページを経由しないアクセスもあり得る）ため、ページ側でも確認する。
  await requireAdminSession();

  const searchParams = await props.searchParams;

  let faqs: FaqAdminRow[] = [];
  let loadError: string | null = null;
  try {
    faqs = await listFaqs();
  } catch (e) {
    // 生のDBエラーは画面に出さず、ログにだけ残す（DEVLOGの申し送り事項に準拠）。
    console.error("[FaqListPage] FAQの取得に失敗しました", e);
    loadError = "FAQの読み込みに失敗しました。時間をおいて再度お試しください。";
  }

  const grouped = FAQ_CATEGORIES.map((category) => ({
    category,
    label: FAQ_CATEGORY_LABEL[category],
    items: faqs.filter((faq) => faq.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="mx-auto max-w-xl pb-24">
      <div className="flex flex-col gap-3 p-4">
        {searchParams.created ? (
          <FlashMessage text="FAQを追加しました。" />
        ) : null}
        {searchParams.updated ? (
          <FlashMessage text="FAQを更新しました。" />
        ) : null}
        {searchParams.deleted ? (
          <FlashMessage text="FAQを削除しました。" />
        ) : null}

        {loadError ? (
          <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {loadError}
          </p>
        ) : faqs.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            まだFAQが登録されていません。下の「＋
            新しいFAQを追加」から作成してください。
          </p>
        ) : (
          grouped.map((group) => (
            <section key={group.category} className="flex flex-col gap-2">
              <h2 className="px-1 text-sm font-semibold text-zinc-500">
                {group.label}
              </h2>
              <ul className="flex flex-col gap-2">
                {group.items.map((faq) => (
                  <li key={faq.id}>
                    <Link
                      href={`/admin/faq/${faq.id}/edit`}
                      className="block min-h-11 rounded-lg border border-zinc-200 bg-white p-4 active:bg-zinc-50"
                    >
                      <p className="font-medium text-zinc-900">
                        {faq.question}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
                        {faq.answer}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white p-4">
        <Link
          href="/admin/faq/new"
          className="flex min-h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-base font-medium text-white"
        >
          ＋ 新しいFAQを追加
        </Link>
      </div>
    </div>
  );
}

function FlashMessage({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
      {text}
    </p>
  );
}
