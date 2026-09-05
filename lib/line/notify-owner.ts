// needs_human判定時に、オーナー自身のLINEへpush通知する。
//
// 背景: needs_human はこれまで conversations に保存され、管理画面
// （/admin/conversations）に赤い「要対応」バッジとして表示されるだけだった。
// オーナーが自分でその画面を見に行かないと気づけない（統合テストで判明した
// 課題）ため、能動的にLINEへ知らせる経路を追加する。

import "server-only";

import { getAppUrl, getLineTestUserId } from "@/lib/env";
import { pushText } from "@/lib/line/client";

// pushTextの5000字上限（LINEの制約）とは別の、通知として読める長さに絞るための
// UX目的の切り詰め。ここで先に切り詰めておくことで、pushText側のthrow
// （5000字超過）が実質発火しない安全網になる（下記コメント参照）。
const EXCERPT_MAX_LENGTH = 200;

function buildExcerpt(receivedMessage: string): string {
  const trimmed = receivedMessage.trim();
  return trimmed.length > EXCERPT_MAX_LENGTH
    ? `${trimmed.slice(0, EXCERPT_MAX_LENGTH)}…`
    : trimmed;
}

// APP_URL設定済み（本番デプロイ後）ならタップできる完全なURLを、未設定
// （開発環境・本番URL未確定の間）なら今まで通りパス表記だけを返す。
// LINEアプリはテキスト中のhttps://文字列を自動でリンク化して表示するので、
// こちら側でリンクボタン等を作り込む必要はない。
function buildDetailLine(): string {
  const appUrl = getAppUrl();
  if (appUrl) {
    return `詳細はこちらでご確認いただけます:\n${appUrl}/admin/conversations`;
  }
  return "詳細は管理画面の会話ログ（/admin/conversations）でご確認いただけます。";
}

function buildMessage(receivedMessage: string, confidence: number): string {
  return `【要対応】自動回答できないお問い合わせがありました

お客様からの質問:
「${buildExcerpt(receivedMessage)}」

確信度: ${Math.round(confidence * 100)}%

内容をご確認のうえ、必要であればお客様にご連絡ください。
${buildDetailLine()}`;
}

/**
 * needs_human判定時にオーナー自身のLINEへpush通知する。
 * logConversationと同じ契約: 内部で握って絶対にthrowしない
 * （通知はあくまで副次的な機能で、本来の返信・記録処理を止めてはいけないため）。
 * LINE_TEST_USER_ID未設定なら通知をスキップする（他の任意設定機能と同じく、
 * 未設定でもwebhook自体は問題なく動く設計に合わせる）。
 *
 * receivedMessageは呼び出し側の生の値をそのまま渡してよい（例: 顧客が
 * 非常に長い文章を送ってきた場合でも）。ここで200字に切り詰めてから
 * pushTextへ渡すため、pushText側の5000字超過throwを気にする必要はない。
 */
export async function notifyOwnerNeedsHuman(input: {
  receivedMessage: string;
  confidence: number;
}): Promise<void> {
  const ownerUserId = getLineTestUserId();
  if (!ownerUserId) {
    console.warn(
      "[notifyOwnerNeedsHuman] LINE_TEST_USER_IDが未設定のため、オーナーへの通知をスキップしました",
    );
    return;
  }
  try {
    await pushText(
      ownerUserId,
      buildMessage(input.receivedMessage, input.confidence),
    );
  } catch (e) {
    console.error("[notifyOwnerNeedsHuman] オーナーへの通知に失敗しました", e);
  }
}
