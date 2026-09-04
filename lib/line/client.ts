// LINE Messaging API の reply（応答メッセージ）呼び出し。
//
// - webhook で受け取ったイベントには replyToken が付く。これを使って
//   reply エンドポイントに POST すると、そのユーザーへ無料で返信できる
//   （push と違い、受信への応答なので）。replyToken は 1 回だけ・短時間だけ有効。
// - 認証は「チャネルアクセストークン」を Bearer で渡す。サーバー専用なので
//   このモジュールは "server-only"。

import "server-only";

import { getLineEnv } from "@/lib/env";

const LINE_REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply";

// LINE のテキストメッセージは 5000 文字まで。FAQ 回答は数文なので通常は超えないが、
// 念のため切り詰めてから送る（API エラーで返信自体が失われるのを防ぐ）。
const MAX_TEXT_LENGTH = 5000;

/**
 * replyToken に対してテキスト 1 通を返信する。
 * 失敗（2xx 以外）は throw する。呼び出し側でログを残し、返信できなくても
 * webhook 全体は 200 を返すこと（LINE の再送＝二重処理を避けるため）。
 */
export async function replyText(
  replyToken: string,
  text: string,
): Promise<void> {
  const { channelAccessToken } = getLineEnv();

  const res = await fetch(LINE_REPLY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: text.slice(0, MAX_TEXT_LENGTH) }],
    }),
  });

  if (!res.ok) {
    // レスポンス本文に理由（invalid reply token 等）が入る。握らずログへ回す。
    const detail = await res.text().catch(() => "");
    throw new Error(`LINE reply API が失敗しました: ${res.status} ${detail}`);
  }
}
