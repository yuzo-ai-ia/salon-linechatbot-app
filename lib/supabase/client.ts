// ブラウザ / クライアントコンポーネント用の Supabase クライアント。
//
// - Publishable キー（新形式・sb_publishable_...）を使う。旧 anon キー相当で、
//   ブラウザに埋め込まれる前提。実データは Supabase の RLS で保護する。
// - "server-only" は付けない（クライアントから使うのが目的）。
// - 生成コストを避けるため、一度作ったインスタンスを使い回す。

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";

let cached: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (cached) return cached;

  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();
  cached = createClient(supabaseUrl, supabasePublishableKey);
  return cached;
}
