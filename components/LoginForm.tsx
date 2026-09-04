"use client";

// ログインフォーム。送信中の表示とエラー表示のために Client Component にしている
// （このプロジェクトで "use client" を使う理由は「送信中/エラーをその場で見せたいから」
// だけに限定する方針）。

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "@/app/admin/login/actions";

const initialState: LoginFormState = { ok: true };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-zinc-700">
          パスワード
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          // 44px以上のタップ領域(min-h-11) + iOSでフォーカス時に勝手にズームされない
          // ように16px以上のフォントサイズ(text-base)にしている。
          className="min-h-11 rounded-lg border border-zinc-300 px-4 text-base focus:border-zinc-500 focus:outline-none"
        />
      </div>

      {!state.ok && state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="min-h-11 rounded-lg bg-zinc-900 px-4 text-base font-medium text-white disabled:opacity-50"
      >
        {isPending ? "確認中…" : "ログイン"}
      </button>
    </form>
  );
}
