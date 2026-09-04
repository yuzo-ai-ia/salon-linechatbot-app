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
 * サーバー専用の秘密値（Supabase）。クライアントバンドルには絶対に含めない。
 * この関数はサーバーコード（lib/supabase/server.ts や API ルート）からのみ呼ぶこと。
 */
export function getServerEnv() {
  return {
    supabaseSecretKey: required(
      "SUPABASE_SECRET_KEY",
      process.env.SUPABASE_SECRET_KEY,
    ),
  };
}

/**
 * LINE Messaging API のサーバー専用設定。
 * getServerEnv() / getOpenAIEnv() とは分けている。LINE を使わない経路
 * （疎通確認ページ・try:answer など）が LINE キー未設定で落ちないようにするため。
 *
 * channelSecret と channelAccessToken は、さらに 2 つの関数に分けて公開する
 * （1 つの getLineEnv() にまとめない）。理由: 署名検証（channelSecret のみ必要）は
 * reply 送信（channelAccessToken のみ必要）より前に走る。1 関数にまとめると、
 * 「access token が未設定/失効している」だけで、正しい署名の webhook まで
 * 検証前に throw して 500 になってしまう（本来 401 or 200 で返すべきところ）。
 * どちらもサーバー専用。絶対に NEXT_PUBLIC_ を付けない。
 */
export function getLineChannelSecret(): string {
  return required("LINE_CHANNEL_SECRET", process.env.LINE_CHANNEL_SECRET);
}

export function getLineChannelAccessToken(): string {
  return required(
    "LINE_CHANNEL_ACCESS_TOKEN",
    process.env.LINE_CHANNEL_ACCESS_TOKEN,
  );
}

/**
 * OpenAI 用のサーバー専用設定。
 * getServerEnv() とは分けている。Supabase しか使わない経路（疎通確認ページ等）が
 * OpenAI キー未設定で落ちないようにするため（関心の分離）。
 */
export function getOpenAIEnv() {
  return {
    apiKey: required("OPENAI_API_KEY", process.env.OPENAI_API_KEY),
    // 使うモデル。未設定ならコスト重視で gpt-4o-mini。
    //   品質が足りなければ .env.local で OPENAI_MODEL=gpt-4o に上げる。
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
  };
}
