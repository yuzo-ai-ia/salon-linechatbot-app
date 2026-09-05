// ログイン後の画面共通レイアウト（ヘッダー＋タブ切り替え＋ログアウトボタン）。
// ログインページはこの Route Group の外にあるので、ここではヘッダーは出ない。
//
// FAQ管理・メニュー管理の両方で共有するレイアウトなので、見出しは「FAQ管理」
// のような特定画面名を固定にせず汎用化し、どちらの画面かはAdminNavTabsの
// タブ切り替えで示す。

import { logoutAction } from "@/app/admin/actions";
import { AdminNavTabs } from "@/components/AdminNavTabs";

export default function AdminProtectedLayout({
  children,
}: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex min-h-11 items-center justify-between border-b border-zinc-200 px-4 py-2">
        <h1 className="text-lg font-semibold">管理画面</h1>
        <form action={logoutAction}>
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-700 active:bg-zinc-50"
          >
            ログアウト
          </button>
        </form>
      </header>
      <AdminNavTabs />
      <main className="flex-1">{children}</main>
    </div>
  );
}
