// LINE webhook の署名検証。
//
// webhook URL は公開されるので、誰でも POST できる。「本当に LINE から来たか」を
// x-line-signature ヘッダで確かめる。方式はチャネルシークレットを鍵にした
// HMAC-SHA256（本文からハッシュを作り、改ざん・なりすましを検知する）。
// LINE 側と同じ鍵・同じ本文から計算したハッシュが一致すれば本物。

import "server-only";

import crypto from "node:crypto";

/**
 * x-line-signature の期待値を計算する。
 *
 * 本番の検証（このファイル）と、ローカル確認スクリプト（scripts/try-webhook.ts）の
 * 両方から使う共通ロジック。2箇所に別々の HMAC 計算を書くと、将来どちらかだけ
 * 直し忘れたときに気づきにくい（例: スクリプト側が古いままだと「正しい署名の
 * テスト」がずっと 401 で落ち続けるのに、誰も気づかない）ため、ここに 1 箇所化する。
 *
 * @param rawBody リクエストボディの「生の文字列」。JSON.parse して再度
 *   文字列化したものは使えない（キー順・空白が変わると署名が一致しない）。
 * @param channelSecret HMAC の鍵（LINE のチャネルシークレット）。
 */
export function computeLineSignature(
  rawBody: string,
  channelSecret: string,
): string {
  return crypto
    .createHmac("sha256", channelSecret)
    .update(rawBody)
    .digest("base64");
}

/**
 * x-line-signature を検証する。
 *
 * @param rawBody リクエストボディの「生の文字列」。route 側では必ず
 *   `await request.text()` を最初に呼び、それをそのまま渡すこと。
 * @param signature x-line-signature ヘッダの値（base64）。未設定なら false。
 * @param channelSecret HMAC の鍵（LINE のチャネルシークレット）。
 */
export function verifyLineSignature(
  rawBody: string,
  signature: string | null,
  channelSecret: string,
): boolean {
  if (!signature) return false;

  const expected = computeLineSignature(rawBody, channelSecret);

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);

  // 長さが違えば timingSafeEqual が例外を投げるので先に弾く。
  // 比較自体は timingSafeEqual を使う（1文字ずつ早期 return する比較だと、
  // 応答時間の差から正解のハッシュを推測されうる = タイミング攻撃対策）。
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
