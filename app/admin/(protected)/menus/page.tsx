// メニュー一覧（表示のみ）。
//
// 実装ステップ1: まずデータ層と読み取り専用の一覧表示だけを作る段階。
// 追加・編集・削除・並び替えは次のステップ以降で追加するため、
// このページにはまだ「＋ 新しいメニューを追加」ボタン等は置かない
// （リンク切れの画面を作らないため）。

import { requireAdminSession } from "@/lib/admin/guard";
import { listMenus, type MenuAdminRow } from "@/lib/menus/admin";

export default async function MenuListPage() {
  // proxy.ts でもガードしているが、FAQ側と同じ多重防御方針でページ側でも確認する。
  await requireAdminSession();

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
        {loadError ? (
          <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {loadError}
          </p>
        ) : menus.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            まだメニューが登録されていません。
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {menus.map((menu) => (
              <li
                key={menu.id}
                className="rounded-lg border border-zinc-200 bg-white p-4"
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
