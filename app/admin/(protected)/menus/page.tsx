// メニュー一覧。各行はタップで編集画面へ（FAQ一覧と同じ構成）。
//
// ステップ2で追加・編集画面、ステップ3で削除機能ができた。並び替えは次のステップ。

import Link from "next/link";
import { requireAdminSession } from "@/lib/admin/guard";
import { listMenus, type MenuAdminRow } from "@/lib/menus/admin";

export default async function MenuListPage(props: PageProps<"/admin/menus">) {
  // proxy.ts でもガードしているが、FAQ側と同じ多重防御方針でページ側でも確認する。
  await requireAdminSession();

  const searchParams = await props.searchParams;

  let menus: MenuAdminRow[] = [];
  let loadError: string | null = null;
  try {
    menus = await listMenus();
  } catch (e) {
    // 生のDBエラーは画面に出さず、ログにだけ残す（FAQ側と同方針）。
    console.error("[MenuListPage] メニューの取得に失敗しました", e);
    loadError =
      "メニューの読み込みに失敗しました。時間をおいて再度お試しください。";
  }

  return (
    <div className="mx-auto max-w-xl pb-24">
      <div className="flex flex-col gap-3 p-4">
        {searchParams.created ? (
          <FlashMessage text="メニューを追加しました。" />
        ) : null}
        {searchParams.updated ? (
          <FlashMessage text="メニューを更新しました。" />
        ) : null}
        {searchParams.deleted ? (
          <FlashMessage text="メニューを削除しました。" />
        ) : null}

        {loadError ? (
          <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {loadError}
          </p>
        ) : menus.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            まだメニューが登録されていません。下の「＋
            新しいメニューを追加」から作成してください。
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {menus.map((menu) => (
              <li key={menu.id}>
                <Link
                  href={`/admin/menus/${menu.id}/edit`}
                  className="block min-h-11 rounded-lg border border-zinc-200 bg-white p-4 active:bg-zinc-50"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-zinc-900">{menu.name}</p>
                    {!menu.is_active ? (
                      <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-600">
                        非表示
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {menu.price.toLocaleString("ja-JP")}円
                  </p>
                  {menu.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
                      {menu.description}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white p-4">
        <Link
          href="/admin/menus/new"
          className="flex min-h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-base font-medium text-white"
        >
          ＋ 新しいメニューを追加
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
