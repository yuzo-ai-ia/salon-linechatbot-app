// 管理画面のログインページ。
// このページ自体は proxy.ts のガード対象から除外している（除外しないと
// ログインすらできなくなるため）。

import { LoginForm } from "@/components/LoginForm";

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">管理画面ログイン</h1>
        <p className="mt-1 text-sm text-zinc-500">
          パスワードを入力してください。
        </p>
      </div>

      <LoginForm />
    </main>
  );
}
