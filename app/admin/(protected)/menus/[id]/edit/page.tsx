import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/admin/guard";
import { getMenuById } from "@/lib/menus/admin";
import { MenuForm } from "@/components/MenuForm";
import { updateMenuAction } from "@/app/admin/(protected)/menus/actions";

export default async function EditMenuPage(
  props: PageProps<"/admin/menus/[id]/edit">,
) {
  await requireAdminSession();

  const { id } = await props.params;
  const menu = await getMenuById(id);
  if (!menu) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="px-4 pt-4 text-lg font-semibold">メニューを編集</h2>
      <MenuForm
        action={updateMenuAction.bind(null, id)}
        initialValues={{
          name: menu.name,
          price: String(menu.price),
          description: menu.description ?? "",
          isActive: menu.is_active,
        }}
        submitLabel="更新する"
      />
      {/* 削除機能は次のステップで実装予定。ここにリンクを置くのはそれから
          （リンク切れの画面を作らないため）。 */}
    </div>
  );
}
