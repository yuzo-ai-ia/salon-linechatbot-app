// サーバー / API ルート / LINE webhook 用の Supabase クライアント。
//
// - Secret キー（新形式・sb_secret_...）を使う。旧 service_role 相当で、
//   RLS をバイパスする。したがって取り扱い注意（顧客の会話ログ等に無制限アクセス）。
// - 先頭の "server-only" により、クライアントコンポーネントから誤って import すると
//   ビルドが失敗する（秘密キーがブラウザに漏れるのを防ぐ）。
// - 生成コストを避けるため、一度作ったインスタンスを使い回す。

import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv, getServerEnv } from "@/lib/env";

let cached: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient {
  if (cached) return cached;

  const { supabaseUrl } = getPublicEnv();
  const { supabaseSecretKey } = getServerEnv();

  cached = createClient(supabaseUrl, supabaseSecretKey, {
    // bot 用途ではユーザーセッションを持たないので、セッション永続化・自動更新は不要。
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
