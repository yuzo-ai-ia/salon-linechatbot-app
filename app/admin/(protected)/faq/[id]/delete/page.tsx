import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin/guard";
import { getFaqById } from "@/lib/faq/admin";
import { FAQ_CATEGORY_LABEL } from "@/lib/faq/categories";
import { deleteFaqAction } from "@/app/admin/(protected)/faq/actions";
import { DeleteConfirmButton } from "@/components/DeleteConfirmButton";

export default async function DeleteFaqPage(
  props: PageProps<"/admin/faq/[id]/delete">,
) {
  await requireAdminSession();

  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const faq = await getFaqById(id);
  if (!faq) notFound();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 p-4">
      <div>
        <h2 className="text-lg font-semibold text-red-700">
          このFAQを削除しますか？
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          削除すると元に戻せません。内容をよく確認してください。
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-xs font-medium text-zinc-500">
          {FAQ_CATEGORY_LABEL[faq.category]}
        </p>
        <p className="mt-1 font-medium text-zinc-900">{faq.question}</p>
        <p className="mt-2 text-sm text-zinc-600">{faq.answer}</p>
      </div>

      {searchParams.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          削除に失敗しました。時間をおいて再度お試しください。
        </p>
      ) : null}

      <form action={deleteFaqAction.bind(null, id)}>
        <DeleteConfirmButton />
      </form>

      <Link
        href={`/admin/faq/${id}/edit`}
        className="flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 text-base font-medium text-zinc-700"
      >
        キャンセルして編集画面に戻る
      </Link>
    </div>
  );
}
