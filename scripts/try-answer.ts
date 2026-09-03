// FAQ 応答ロジックの手元確認用スクリプト。
//
//   npm run try:answer -- "明日の11時空いてますか？"
//
// package.json の try:answer が
//   tsx --conditions=react-server --env-file=.env.local
// で実行する。
//   - --env-file: .env.local の OPENAI_API_KEY / Supabase キーを読む。
//   - --conditions=react-server: lib/ 側の `import "server-only"` は
//     この export 条件下では空モジュールに解決される。付けないと
//     「Client Component から import された」と誤検知して落ちる。
// 実データ or supabase/seed/sample_data.sql を Studio で投入しておくこと。

import { generateFaqAnswer } from "@/lib/faq/generate-answer";

async function main(): Promise<void> {
  const question = process.argv[2];
  if (!question || question.trim() === "") {
    console.error('使い方: npm run try:answer -- "質問文"');
    process.exit(1);
  }

  console.log(`Q: ${question}\n`);
  const result = await generateFaqAnswer(question);

  console.log(`A: ${result.answer}`);
  console.log(`confidence: ${result.confidence}`);
  console.log(`needsHuman : ${result.needsHuman}`);
}

main().catch((e) => {
  // generateFaqAnswer は内部で握るので基本ここには来ないが、保険。
  console.error(e);
  process.exit(1);
});
