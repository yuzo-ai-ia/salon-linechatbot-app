// メニュー一覧。各行はタップで編集画面へ（FAQ一覧と同じ構成）。
// 各行の右側に↑↓ボタンを置き、隣のメニューと sort_order を入れ替えて
// 並び替えられるようにしている（先頭で↑・末尾で↓は disabled）。
//
// ステップ2で追加・編集画面、ステップ3で削除機能、ステップ4で並び替えができた。

import Link from "next/link";
import { requireAdminSession } from "@/lib/admin/guard";
import { listMenus, type MenuAdminRow } from "@/lib/menus/admin";
import { moveMenuAction } from "@/app/admin/(protected)/menus/actions";

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
        {searchParams.moveError ? (
          <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            並び替えに失敗しました。時間をおいて再度お試しください。
          </p>
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
            {menus.map((menu, index) => (
              <li key={menu.id} className="flex items-stretch gap-2">
                <Link
                  href={`/admin/menus/${menu.id}/edit`}
                  className="block min-h-11 flex-1 rounded-lg border border-zinc-200 bg-white p-4 active:bg-zinc-50"
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

                {/* 並び替えボタン。<form>を<Link>（=<a>）の中に入れるとHTML的に
                    不正になるため、Linkの兄弟要素として横に並べている。 */}
                <div className="flex flex-col gap-1">
                  <form action={moveMenuAction.bind(null, menu.id, "up")}>
                    <button
                      type="submit"
                      disabled={index === 0}
                      aria-label={`${menu.name}を上に移動`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-300 text-lg text-zinc-700 active:bg-zinc-50 disabled:opacity-30"
                    >
                      ↑
                    </button>
                  </form>
                  <form action={moveMenuAction.bind(null, menu.id, "down")}>
                    <button
                      type="submit"
                      disabled={index === menus.length - 1}
                      aria-label={`${menu.name}を下に移動`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-300 text-lg text-zinc-700 active:bg-zinc-50 disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white p-4">
        <Link
          href="/admin/menus/new"
          className="flex min-h-11 items-center justify-center rounded-lg bg-greige-800 px-4 text-base font-medium text-white"
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
