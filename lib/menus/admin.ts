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
