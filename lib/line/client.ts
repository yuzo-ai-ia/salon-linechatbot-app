// LINE Messaging API のメッセージ送信呼び出し（reply / broadcast / push）。
//
// - webhook で受け取ったイベントには replyToken が付く。これを使って
//   reply エンドポイントに POST すると、そのユーザーへ無料で返信できる
//   （push と違い、受信への応答なので）。replyToken は 1 回だけ・短時間だけ有効。
// - broadcast は全友だちへの一斉配信、push は特定 1 人への送信
//   （broadcastのテスト送信に使う。自分のLINE user idだけに届く）。
//   どちらも replyToken 不要で、チャネルアクセストークンの認証のみで送れる。
// - 認証は「チャネルアクセストークン」を Bearer で渡す。サーバー専用なので
//   このモジュールは "server-only"。

import "server-only";

import { getLineChannelAccessToken } from "@/lib/env";

const LINE_REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply";
const LINE_BROADCAST_ENDPOINT = "https://api.line.me/v2/bot/message/broadcast";
const LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";

// LINE のテキストメッセージは 5000 文字まで。FAQ 回答は数文なので通常は超えないが、
// 念のため切り詰めてから送る（API エラーで返信自体が失われるのを防ぐ）。
const MAX_TEXT_LENGTH = 5000;

/**
 * LINE の message系エンドポイントへの共通POST処理。
 * 失敗（2xx 以外）は throw する（res.text() 自体の失敗もログを残してから空文字で継続）。
 * reply / broadcast / push で認証ヘッダーとエラーハンドリングが完全に同じなので、
 * ここに集約して重複を無くしている。
 */
async function postLineMessage(
  endpoint: string,
  body: unknown,
  label: string,
): Promise<void> {
  const channelAccessToken = getLineChannelAccessToken();

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // レスポンス本文に理由（invalid reply token・上限超過等）が入る。握らずログへ回す。
    const detail = await res.text().catch((textError: unknown) => {
      console.error(
        `[${label}] エラーレスポンスの読み取りにも失敗しました`,
        textError,
      );
      return "";
    });
    throw new Error(
      `LINE ${label} API が失敗しました: ${res.status} ${detail}`,
    );
  }
}

function assertWithinLineTextLimit(text: string): void {
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(
      `LINEのテキストメッセージは${MAX_TEXT_LENGTH}文字までです（実際: ${text.length}文字）`,
    );
  }
}

/**
 * replyToken に対してテキスト 1 通を返信する。
 * 失敗（2xx 以外）は throw する。呼び出し側でログを残し、返信できなくても
 * webhook 全体は 200 を返すこと（LINE の再送＝二重処理を避けるため）。
 */
export async function replyText(
  replyToken: string,
  text: string,
): Promise<void> {
  // bot の自動応答は本文を作る側（generateFaqAnswer等）が制御しきれないので、
  // ここでは黙って切り詰めて安全側に倒す（broadcast/pushとは事情が異なる）。
  await postLineMessage(
    LINE_REPLY_ENDPOINT,
    {
      replyToken,
      messages: [{ type: "text", text: text.slice(0, MAX_TEXT_LENGTH) }],
    },
    "reply",
  );
}

/**
 * LINE友だち全員にテキスト1通を一斉配信する。取り消せないので呼び出し側で
 * 必ず確認ステップを挟むこと。失敗（2xx以外）はthrowする。
 * 文字数超過は黙って切り詰めず、呼び出し側に気づかせるためthrowする
 * （管理者が書いた文面を無言で削るとかえって誤解を招くため）。
 */
export async function broadcastText(text: string): Promise<void> {
  assertWithinLineTextLimit(text);
  await postLineMessage(
    LINE_BROADCAST_ENDPOINT,
    { messages: [{ type: "text", text }] },
    "broadcast",
  );
}

/**
 * 特定の1人（to）にだけテキスト1通を送る。broadcastのテスト送信用。
 */
export async function pushText(to: string, text: string): Promise<void> {
  assertWithinLineTextLimit(text);
  await postLineMessage(
    LINE_PUSH_ENDPOINT,
    { to, messages: [{ type: "text", text }] },
    "push",
  );
}
