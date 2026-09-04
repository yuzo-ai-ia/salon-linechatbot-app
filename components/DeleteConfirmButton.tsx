"use client";

// 削除確認画面の最終ボタン。useFormStatus で送信中を検知し、
// 連打による二重削除を防ぐ（disabled）。

import { useFormStatus } from "react-dom";

export function DeleteConfirmButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-11 w-full items-center justify-center rounded-lg bg-red-600 px-4 text-base font-medium text-white disabled:opacity-50"
    >
      {pending ? "削除中…" : "削除する"}
    </button>
  );
}
