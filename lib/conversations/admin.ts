// 管理画面（/admin/conversations）用の会話ログ読み取り専用データ層。
//
// lib/faq/admin.ts / lib/menus/admin.ts と同じ方針:
// - conversations テーブルへの読み書きは RLS ポリシーが無く、GRANT も
//   service_role のみ（supabase/migrations/20260903_init_schema.sql）。
//   したがって getServerSupabase()（secret キー）経由でしか読めない。
// - エラーは握りつぶさず throw する。生DBエラーをユーザーに見せない変換は
//   呼び出し側（page）の責務。
//
// menus/faq と違い会話ログは LINE メッセージ1件＝1行で際限なく増え続ける。
// listMenus()/listFaqs() のような絞り込みなしの全件取得はしない。

import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";

export type ConversationAdminRow = {
  id: string;
  line_user_id: string;
  received_message: string;
  bot_response: string | null;
  confidence: number | null;
  needs_human: boolean;
  created_at: string;
};

// v1では件数制御をこの定数だけで行う（ページ送りは実装しない）。
// 増えて困るようになったら次のステップでページネーションを検討する。
const CONVERSATION_LIST_LIMIT = 50;

/**
 * 直近の会話ログを新しい順に最大 CONVERSATION_LIST_LIMIT 件取得する。
 */
export async function listRecentConversations(): Promise<
  ConversationAdminRow[]
> {
  const supabase = getServerSupabase();
  // created_at desc にはマイグレーションで貼った conversations_created_at_idx が効く。
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, line_user_id, received_message, bot_response, confidence, needs_human, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(CONVERSATION_LIST_LIMIT);
  if (error) throw error;
  return (data ?? []) as ConversationAdminRow[];
}
