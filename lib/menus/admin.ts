// 管理画面（/admin/menus）用のメニューCRUDデータ層。
//
// lib/faq/admin.ts と同じ方針:
// - menus テーブルへの insert/update/delete は RLS ポリシーが無く、GRANT も
//   service_role のみ（supabase/migrations/20260903_init_schema.sql）。
//   したがって getServerSupabase()（secret キー）経由でしか書き込めない。
// - エラーは握りつぶさず throw する。生DBエラーをユーザーに見せない変換は
//   呼び出し側（Server Action / page）の責務。

import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";

export type MenuAdminRow = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// sort_order はフォームから直接編集させない設計にするため、ここには含めない。
// （追加時は自動採番、変更は一覧の並び替えボタン経由のみ。今後のステップで実装。）
export type MenuInput = {
  name: string;
  price: number;
  description: string | null;
  is_active: boolean;
};

const MENU_COLUMNS =
  "id, name, price, description, is_active, sort_order, created_at, updated_at";

export async function listMenus(): Promise<MenuAdminRow[]> {
  const supabase = getServerSupabase();
  // bot 用の loadKnowledgeBase() と違い、is_active で絞り込まない。
  // 管理画面では「非表示にしているメニュー」も一覧で見えて編集できる必要があるため。
  const { data, error } = await supabase
    .from("menus")
    .select(MENU_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MenuAdminRow[];
}

/**
 * id 指定で1件取得する。存在しなければ null（呼び出し側で notFound() 等にする）。
 */
export async function getMenuById(id: string): Promise<MenuAdminRow | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("menus")
    .select(MENU_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as MenuAdminRow | null) ?? null;
}

export async function createMenu(input: MenuInput): Promise<void> {
  const supabase = getServerSupabase();

  // sort_order はフォームに無いので自動採番する。既存メニューの最大値+1にすることで
  // 新規追加分は常に一覧の末尾に入る（並び替えは一覧の↑↓ボタン側で今後実装）。
  const { data: maxRow, error: maxError } = await supabase
    .from("menus")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxError) throw maxError;
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("menus")
    .insert({ ...input, sort_order: nextSortOrder });
  if (error) throw error;
}

export async function updateMenu(id: string, input: MenuInput): Promise<void> {
  const supabase = getServerSupabase();
  // sort_order は更新しない（並び替えは一覧の↑↓ボタン側の責務にするため）。
  const { error } = await supabase.from("menus").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteMenu(id: string): Promise<void> {
  const supabase = getServerSupabase();
  const { error } = await supabase.from("menus").delete().eq("id", id);
  if (error) throw error;
}

export type MoveDirection = "up" | "down";

/**
 * 一覧上で隣り合うメニューと sort_order を入れ替える。
 * 先頭で up / 末尾で down が呼ばれた場合は何もしない（呼び出し側の一覧では
 * ボタン自体を disabled にしているので、通常この分岐には来ない）。
 */
export async function moveMenu(
  id: string,
  direction: MoveDirection,
): Promise<void> {
  const supabase = getServerSupabase();

  // 一覧表示と同じ並び（sort_order昇順→created_at昇順）を毎回取り直してから
  // 隣を探す。表示中の一覧が古い場合でも、その時点の実データを基準に動かすため。
  const menus = await listMenus();
  const index = menus.findIndex((menu) => menu.id === id);
  if (index === -1) return;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= menus.length) return;

  const current = menus[index];
  const target = menus[targetIndex];

  const { error: currentError } = await supabase
    .from("menus")
    .update({ sort_order: target.sort_order })
    .eq("id", current.id);
  if (currentError) throw currentError;

  const { error: targetError } = await supabase
    .from("menus")
    .update({ sort_order: current.sort_order })
    .eq("id", target.id);
  if (targetError) {
    // 2件目の更新が失敗すると sort_order が重複したまま残ってしまう
    // （2クエリなのでトランザクションではない）。片方だけ更新された状態を
    // 残さないよう、1件目を元の値に戻してからエラーを投げる。
    const { error: rollbackError } = await supabase
      .from("menus")
      .update({ sort_order: current.sort_order })
      .eq("id", current.id);
    if (rollbackError) {
      console.error(
        "[moveMenu] ロールバックにも失敗しました。sort_orderが重複している可能性があります",
        rollbackError,
      );
    }
    throw targetError;
  }
}
