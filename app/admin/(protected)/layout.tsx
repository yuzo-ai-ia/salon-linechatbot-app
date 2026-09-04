// ログイン後の画面共通レイアウト（ヘッダー＋ログアウトボタン）。
// ログインページはこの Route Group の外にあるので、ここではヘッダーは出ない。

import { logoutAction } from "@/app/admin/actions";

export default function AdminProtectedLayout({
  children,
}: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex min-h-11 items-center justify-between border-b border-zinc-200 px-4 py-2">
        <h1 className="text-lg font-semibold">FAQ管理</h1>
        <form action={logoutAction}>
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-700 active:bg-zinc-50"
          >
            ログアウト
          </button>
        </form>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
