import { requireAdminSession } from "@/lib/admin/guard";
import { FaqForm } from "@/components/FaqForm";
import { createFaqAction } from "@/app/admin/(protected)/faq/actions";

export default async function NewFaqPage() {
  await requireAdminSession();

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="px-4 pt-4 text-lg font-semibold">FAQを追加</h2>
      <FaqForm
        action={createFaqAction}
        initialValues={{ category: "other", question: "", answer: "" }}
        submitLabel="追加する"
      />
    </div>
  );
}
