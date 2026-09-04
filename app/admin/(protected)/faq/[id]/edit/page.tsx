import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin/guard";
import { getFaqById } from "@/lib/faq/admin";
import { FaqForm } from "@/components/FaqForm";
import { updateFaqAction } from "@/app/admin/(protected)/faq/actions";

export default async function EditFaqPage(
  props: PageProps<"/admin/faq/[id]/edit">,
) {
  await requireAdminSession();

  const { id } = await props.params;
  const faq = await getFaqById(id);
  if (!faq) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="px-4 pt-4 text-lg font-semibold">FAQを編集</h2>
      <FaqForm
        action={updateFaqAction.bind(null, id)}
        initialValues={{
          category: faq.category,
          question: faq.question,
          answer: faq.answer,
        }}
        submitLabel="更新する"
      />
      <div className="px-4 pb-8">
        {/* 誤操作防止のため、削除はここから確認画面を経由させる
            （一覧やこの画面に直接の削除ボタンは置かない）。 */}
        <Link
          href={`/admin/faq/${id}/delete`}
          className="inline-flex min-h-11 items-center text-sm text-red-600 underline"
        >
          このFAQを削除する
        </Link>
      </div>
    </div>
  );
}
