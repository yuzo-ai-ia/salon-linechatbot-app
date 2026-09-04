// Server Components / Server Actions から呼ぶ、管理画面のログインチェック。
//
// proxy.ts（ルーティング入口でのガード）と二重になるが、Next.js の公式ドキュメントに
// 「Server Action はページを経由せず直接 POST でも呼び出せるので、各 Server Action の
// 内部でも認証確認をすること」と明記されているため、ここでも独立して確認する
// （どちらか片方が抜けても事故らないようにする多重防御）。

import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/admin/session";

/**
 * ログインしていなければ /admin/login にリダイレクトする。
 * 管理画面の各ページ・各 Server Action の先頭で呼ぶこと。
 */
export async function requireAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!verifyAdminSessionToken(token)) {
    redirect("/admin/login");
  }
}
