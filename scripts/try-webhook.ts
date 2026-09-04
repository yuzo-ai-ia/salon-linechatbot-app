// LINE webhook のローカル動作確認スクリプト（LINE 実機なしで通しで確認する用）。
//
//   npm run dev で別ターミナルにサーバーを立てておいてから:
//     npm run try:webhook -- "営業時間を教えてください"
//     npm run try:webhook -- --bad-signature "テスト"   ← 401 になることの確認
//
// package.json の try:webhook が
//   tsx --conditions=react-server --env-file=.env.local
// で実行する（server-only モジュールを tsx から読むための条件。詳細は
// try-answer.ts のコメント、または DEVLOG フェーズ1参照）。
//
// 本物の LINE アプリを経由しないので replyToken はダミー値になる。そのため
// webhook 内の LINE reply API 呼び出しは 401 で失敗する ← これは想定内。
// 確認したいのは「署名検証 → イベント処理 → 回答生成 → conversations 保存」の
// 一連の流れが通ることと、conversations に実際に行が増えること。

import { getServerSupabase } from "@/lib/supabase/server";
import { getLineEnv } from "@/lib/env";
import crypto from "node:crypto";

const WEBHOOK_URL = "http://localhost:3000/api/line/webhook";
// テスト専用の固定 userId。他のテストと混ざらないよう分かりやすい値にする。
const TEST_USER_ID = "try-webhook-script-user";

function buildBody(text: string): string {
  const payload = {
    destination: "try-webhook-script",
    events: [
      {
        type: "message",
        replyToken: "dummy-reply-token-from-try-webhook",
        source: { type: "user", userId: TEST_USER_ID },
        message: { id: "dummy-message-id", type: "text", text },
      },
    ],
  };
  return JSON.stringify(payload);
}

function sign(rawBody: string, channelSecret: string): string {
  return crypto
    .createHmac("sha256", channelSecret)
    .update(rawBody)
    .digest("base64");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const badSignature = args.includes("--bad-signature");
  const question = args.find((a) => a !== "--bad-signature");

  if (!question || question.trim() === "") {
    console.error('使い方: npm run try:webhook -- "質問文" [--bad-signature]');
    process.exit(1);
  }

  const { channelSecret } = getLineEnv();
  const rawBody = buildBody(question);
  const signature = badSignature
    ? "invalid-signature-for-testing"
    : sign(rawBody, channelSecret);

  console.log(`POST ${WEBHOOK_URL}`);
  console.log(`Q: ${question}`);
  console.log(`--bad-signature: ${badSignature}\n`);

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-line-signature": signature,
    },
    body: rawBody,
  });

  console.log(`status: ${res.status}`);
  console.log(`body  : ${await res.text()}\n`);

  if (badSignature) {
    // 署名が不正なので webhook 側でイベント処理は行われていないはず。
    // conversations は見に行かず、status が 401 であることだけが確認ポイント。
    return;
  }

  // webhook はレスポンスを返す前に conversations への保存まで完了させているので、
  // 少し待ってから確認する必要はない（インライン await 設計のため）。
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("conversations")
    .select("received_message, bot_response, confidence, created_at")
    .eq("line_user_id", TEST_USER_ID)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("conversations の確認に失敗しました", error);
    return;
  }

  console.log("conversations の最新行:");
  console.log(data?.[0] ?? "（見つかりませんでした）");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
