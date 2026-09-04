// LINE Messaging API の webhook 受け口。
//
// 流れ: 受信 → 署名検証 → イベントごとに generateFaqAnswer() → reply →
//       conversations へ記録。
//
// 設計メモ:
//   - runtime は nodejs。署名検証で node:crypto を使うため。
//   - 生成に数秒かかるが、個人店の低トラフィック前提でインラインで await する
//     （先に 200 を返して after() で処理する形は将来の改善候補）。
//   - 正常な署名のリクエストには常に 200 を返す。200 以外だと LINE が再送し、
//     二重返信になるため。1 イベントの失敗が他イベントを巻き込まないよう
//     Promise.allSettled で処理する。

import { getLineEnv } from "@/lib/env";
import { logConversation } from "@/lib/conversations/log";
import { generateFaqAnswer } from "@/lib/faq/generate-answer";
import { replyText } from "@/lib/line/client";
import type { LineEvent, LineWebhookBody } from "@/lib/line/types";
import { verifyLineSignature } from "@/lib/line/verify-signature";

export const runtime = "nodejs";
// 生ボディ・署名ヘッダを読むので毎回リクエスト時に実行する（キャッシュしない）。
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  // 署名検証のため、まず生の本文を読む（JSON.parse 前の文字列そのもの）。
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");
  const { channelSecret } = getLineEnv();

  if (!verifyLineSignature(rawBody, signature, channelSecret)) {
    console.warn("[line/webhook] 署名検証に失敗しました");
    return new Response("Unauthorized", { status: 401 });
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody) as LineWebhookBody;
  } catch {
    console.warn("[line/webhook] ボディを JSON として解釈できませんでした");
    return new Response("Bad Request", { status: 400 });
  }

  // webhook 登録時の疎通確認は events: [] で飛んでくる → 空回りして 200 になる。
  await Promise.allSettled((body.events ?? []).map(handleEvent));

  return new Response("OK", { status: 200 });
}

/**
 * 1 イベントを処理する。テキストメッセージ以外は黙って無視する
 * （スタンプ・画像・follow などは今フェーズでは扱わない）。
 */
async function handleEvent(event: LineEvent): Promise<void> {
  if (event.type !== "message" || event.message?.type !== "text") return;

  const replyToken = event.replyToken;
  const lineUserId = event.source?.userId;
  const text = event.message.text?.trim();

  // 返信先・送信者・本文が揃わなければ処理できない。
  if (!replyToken || !lineUserId || !text) return;

  // 生成は失敗しても FALLBACK_ANSWER を返す設計（throw しない）。
  const result = await generateFaqAnswer(text);

  // 返信できなくても webhook は 200 で返す（再送＝二重処理を避ける）。
  // 失敗理由はログに残す（invalid reply token 等）。
  try {
    await replyText(replyToken, result.answer);
  } catch (e) {
    console.error("[line/webhook] 返信に失敗しました", e);
  }

  // 記録は返信より優先度が下。logConversation は内部で握るので await でよい。
  await logConversation({
    lineUserId,
    receivedMessage: text,
    botResponse: result.answer,
    confidence: result.confidence,
  });
}
