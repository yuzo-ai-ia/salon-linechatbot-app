// 管理画面（/admin）のログインセッションを表す Cookie の発行・検証。
//
// なぜ DB やセッションストアを使わないか:
//   オーナー1人しか使わない前提なので、「ログイン中かどうか」を判定できれば十分。
//   パスワードを鍵にした HMAC 署名（lib/line/verify-signature.ts と同じ考え方）で
//   Cookie の値自体を検証できるようにし、サーバー側で状態を持たない設計にした。
//
// なぜ "server-only" を付けないか:
//   proxy.ts（Next.js のミドルウェア相当）と Server Actions の両方からこのファイルを
//   import する。"server-only" パッケージは package.json の exports で
//   "react-server" 条件が立っている場所でしか有効に働かず、proxy.ts のような
//   React のレンダリングパイプライン外から import すると「クライアントから
//   import された」と誤検知して throw する恐れがある（DEVLOG に記録した、
//   tsx から server-only を import して同種の問題が起きた前例と同じ罠）。
//   このファイル自体は Next.js の API に依存しない純粋な署名ロジックなので、
//   server-only を付けなくても秘密情報がブラウザに漏れることはない
//   （呼び出し元の lib/admin/guard.ts 側で server-only を付けて守る）。

import crypto from "node:crypto";
import { getAdminEnv } from "@/lib/env";

export const ADMIN_SESSION_COOKIE = "admin_session";

// セッションの有効期間。この期間を過ぎると再ログインが必要になる。
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7日

function computeSignature(expiresAt: number, password: string): string {
  return crypto
    .createHmac("sha256", password)
    .update(`admin-session:${expiresAt}`)
    .digest("base64url");
}

/**
 * ログイン成功時に発行する Cookie の値を作る。
 * 形式: "<有効期限のUnix秒>.<HMAC署名>"。署名があるので、パスワードを知らない
 * 第三者はこの文字列を偽造できない（改ざんすれば署名が一致しなくなる）。
 */
export function createAdminSessionToken(): {
  token: string;
  expiresAt: Date;
} {
  const { password } = getAdminEnv();
  const expiresAtSeconds =
    Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const signature = computeSignature(expiresAtSeconds, password);

  return {
    token: `${expiresAtSeconds}.${signature}`,
    expiresAt: new Date(expiresAtSeconds * 1000),
  };
}

/**
 * Cookie の値が「有効期限内」かつ「改ざんされていない」ことを確認する。
 * @param token request.cookies から読んだ Cookie の値（無ければ undefined/null）。
 */
export function verifyAdminSessionToken(
  token: string | undefined | null,
): boolean {
  if (!token) return false;

  const [expiresAtRaw, signature] = token.split(".");
  if (!expiresAtRaw || !signature) return false;

  const expiresAtSeconds = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAtSeconds)) return false;
  if (expiresAtSeconds < Math.floor(Date.now() / 1000)) return false; // 期限切れ

  const { password } = getAdminEnv();
  const expected = computeSignature(expiresAtSeconds, password);

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);

  // 長さが違うと timingSafeEqual が例外を投げるので先に弾く。
  // timingSafeEqual を使うのは lib/line/verify-signature.ts と同じ理由
  // （比較にかかる時間の差から正解を推測されるタイミング攻撃を防ぐ）。
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * ログインフォームで入力されたパスワードが正しいか確認する。
 * こちらも timingSafeEqual を使い、文字列の一致を「時間差から漏らさない」比較にする。
 */
export function verifyAdminPassword(input: string): boolean {
  const { password } = getAdminEnv();

  const a = Buffer.from(input);
  const b = Buffer.from(password);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
