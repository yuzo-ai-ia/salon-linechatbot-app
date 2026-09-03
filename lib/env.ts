// 環境変数を一元的に読むモジュール。
// なぜ集約するか:
//   - `process.env` を各所で直接参照すると、未設定時の失敗が分かりにくく、
//     どの変数が必要かも追いにくい。ここに集めて「未設定なら明示的に落とす」。
//   - 公開してよい値（NEXT_PUBLIC_）とサーバー専用の値を型で分ける。
//
// 注意: 値の検証は「呼ばれたとき」に行う（関数にしている）。
//   モジュール読み込み時に検証すると、ビルド時のプリレンダー段階で
//   まだ .env.local が無い環境でも落ちてしまうため。

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `環境変数 ${name} が未設定です。.env.local を確認してください（テンプレート: .env.local.example）。`,
    );
  }
  return value;
}

/**
 * ブラウザにも埋め込まれる公開値。
 * Publishable キーは公開前提で、実データは Supabase の RLS で保護する。
 */
export function getPublicEnv() {
  return {
    supabaseUrl: required(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    supabasePublishableKey: required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}

/**
 * サーバー専用の秘密値。クライアントバンドルには絶対に含めない。
 * この関数はサーバーコード（lib/supabase/server.ts や API ルート）からのみ呼ぶこと。
 *
 * OPENAI_API_KEY / LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET は
 * 次フェーズで使うため、必要になった時点でここに追加する。
 */
export function getServerEnv() {
  return {
    supabaseSecretKey: required(
      "SUPABASE_SECRET_KEY",
      process.env.SUPABASE_SECRET_KEY,
    ),
  };
}
