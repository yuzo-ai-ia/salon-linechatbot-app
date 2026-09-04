"use server";

// ログインフォームの送信を処理する Server Action。
// フォームの action={loginAction} から直接呼ばれる（クライアントから見ると
// 「サーバーの関数をそのまま呼んでいるように書けるRPC」だが、実際には
// 裏側でPOSTリクエストが飛んでいる）。

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  verifyAdminPassword,
} from "@/lib/admin/session";

export type LoginFormState = {
  ok: boolean;
  error?: string;
};

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const password = formData.get("password");

  if (typeof password !== "string" || password.length === 0) {
    return { ok: false, error: "パスワードを入力してください。" };
  }

  let isValid: boolean;
  try {
    isValid = verifyAdminPassword(password);
  } catch (e) {
    // ADMIN_PASSWORD 未設定など、環境側の問題。生のエラーは見せず、
    // 原因究明用にサーバーログにだけ残す。
    console.error("[loginAction] パスワード確認に失敗しました", e);
    return {
      ok: false,
      error: "ログインに失敗しました。時間をおいて再度お試しください。",
    };
  }

  if (!isValid) {
    return {
      ok: false,
      error: "パスワードが違います。もう一度お試しください。",
    };
  }

  const { token, expiresAt } = createAdminSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true, // JavaScript から読めないようにする（XSSでの盗み見対策）。
    // 開発中はローカルの http://localhost でも動くように本番のみ Secure を強制する。
    // （Secure Cookie は原則 HTTPS 専用。localhost は例外的に許可されるが、
    //  スマホ実機を ngrok 無しで LAN 経由の http:// でテストする場合に備える）。
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  // redirect() は内部で例外を投げて画面遷移を実現する仕組みなので、
  // try/catch の外（DBやCookie操作が終わった後）で呼ぶ。
  redirect("/admin/faq");
}
