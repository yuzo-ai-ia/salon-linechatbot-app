import { requireAdminSession } from "@/lib/admin/guard";
import { MenuForm } from "@/components/MenuForm";
import { createMenuAction } from "@/app/admin/(protected)/menus/actions";

export default async function NewMenuPage() {
  await requireAdminSession();

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="px-4 pt-4 text-lg font-semibold">メニューを追加</h2>
      <MenuForm
        action={createMenuAction}
        initialValues={{
          name: "",
          price: "",
          description: "",
          isActive: true,
        }}
        submitLabel="追加する"
      />
    </div>
  );
}
