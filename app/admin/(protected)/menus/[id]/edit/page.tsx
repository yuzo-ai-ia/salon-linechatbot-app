import { notFound } from "next/navigation";
import Link from "next/link";
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
      <div className="px-4 pb-8">
        {/* 誤操作防止のため、削除はここから確認画面を経由させる
            （一覧やこの画面に直接の削除ボタンは置かない。FAQ側と同方針）。 */}
        <Link
          href={`/admin/menus/${id}/delete`}
          className="inline-flex min-h-11 items-center text-sm text-red-600 underline"
        >
          このメニューを削除する
        </Link>
      </div>
    </div>
  );
}
