// 管理画面（/admin/broadcasts）用の配信履歴データ層。
//
// lib/conversations/admin.ts と同じ方針:
// - broadcasts テーブルへの読み書きは RLS ポリシーが無く、GRANT も
//   service_role のみ（supabase/migrations/20260906_create_broadcasts.sql）。
//   したがって getServerSupabase()（secret キー）経由でしか読み書きできない。
// - エラーは握りつぶさず throw する。生DBエラーをユーザーに見せない変換は
//   呼び出し側（Server Action / page）の責務。
// - 配信履歴も conversations 同様に増え続けるログなので、全件取得ではなく
//   limit を付ける。

import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";

export type BroadcastStatus = "sent" | "failed";

export type BroadcastAdminRow = {
  id: string;
  message: string;
  status: BroadcastStatus;
  error_detail: string | null;
  created_at: string;
};

const BROADCAST_LIST_LIMIT = 50;

export async function listRecentBroadcasts(): Promise<BroadcastAdminRow[]> {
  const supabase = getServerSupabase();
  // created_at desc にはマイグレーションで貼った broadcasts_created_at_idx が効く。
  const { data, error } = await supabase
    .from("broadcasts")
    .select("id, message, status, error_detail, created_at")
    .order("created_at", { ascending: false })
    .limit(BROADCAST_LIST_LIMIT);
  if (error) throw error;
  return (data ?? []) as BroadcastAdminRow[];
}

export async function recordBroadcast(input: {
  message: string;
  status: BroadcastStatus;
  errorDetail: string | null;
}): Promise<void> {
  const supabase = getServerSupabase();
  const { error } = await supabase.from("broadcasts").insert({
    message: input.message,
    status: input.status,
    error_detail: input.errorDetail,
  });
  if (error) throw error;
}
