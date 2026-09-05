"use client";

// /admin 配下で想定外の例外が起きたときの表示（Next.jsのError Boundary規約）。
// 生のエラー内容（DBのhint/details等）は絶対に画面に出さず、ここでは常に
// 定型の日本語メッセージだけを表示する。詳細はコンソールにだけ残す。

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AdminError]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-base font-medium text-zinc-900">
        予期しないエラーが発生しました。
      </p>
      <p className="text-sm text-zinc-500">
        時間をおいてもう一度お試しください。
      </p>
      <button
        type="button"
        onClick={reset}
        className="min-h-11 rounded-lg bg-greige-800 px-4 text-base font-medium text-white"
      >
        もう一度試す
      </button>
    </div>
  );
}
