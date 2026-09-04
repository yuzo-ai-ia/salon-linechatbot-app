// 管理画面（/admin）への入口ガード。
//
// 「middleware」という名前・Edge ランタイムは Next.js 16 で非推奨になり、
// このファイル名（proxy.ts）・関数名（proxy）・常時 Node.js ランタイムに
// 置き換わった（node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md
// で確認済み）。ランタイムを自分で選ぶことはできない（常に nodejs）。
// そのため lib/admin/session.ts の node:crypto を使った検証がそのまま動く。
//
// ここでの役割は「ログインしていない人を /admin/login に送り返す」だけ。
// 実際のデータ書き込み（Server Actions）側でも requireAdminSession() を
// 呼んでいるので、ここが漏れても事故にはならない（多重防御）。

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/admin/session";

export function proxy(request: NextRequest) {
  // ログインページ自体はガードしない（ここで弾くと永遠にログインできなくなる）。
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
