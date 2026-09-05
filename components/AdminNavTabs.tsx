"use client";

// FAQ管理⇔メニュー管理の切り替えタブ。
// 現在地のハイライトに現在のURL（usePathname）が必要なので、ここだけ
// "use client" にしている（layout.tsx自体はServer Componentのまま）。

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/faq", label: "FAQ管理" },
  { href: "/admin/menus", label: "メニュー管理" },
] as const;

export function AdminNavTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex border-b border-zinc-200">
      {TABS.map((tab) => {
        // 一覧・新規追加・編集・削除など配下の画面でも該当タブをアクティブにする。
        const isActive =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex min-h-11 flex-1 items-center justify-center border-b-2 text-sm font-medium ${
              isActive
                ? "border-zinc-900 text-zinc-900"
                : "border-transparent text-zinc-500"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
