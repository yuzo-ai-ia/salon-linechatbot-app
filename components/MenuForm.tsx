"use client";

// メニューの追加・編集で共有するフォーム。
// FaqForm.tsx と同じく useActionState で「送信中の表示」「バリデーションエラー」
// 「入力値の保持」をまとめて扱う（エラーで差し戻された時に入力し直させないため）。

import { useActionState } from "react";
import type {
  MenuFormState,
  MenuFormValues,
} from "@/app/admin/(protected)/menus/actions";

type Props = {
  action: (
    prevState: MenuFormState,
    formData: FormData,
  ) => Promise<MenuFormState>;
  initialValues: MenuFormValues;
  submitLabel: string;
};

export function MenuForm({ action, initialValues, submitLabel }: Props) {
  const [state, formAction, isPending] = useActionState(action, {
    ok: true,
    values: initialValues,
  });

  return (
    <form action={formAction} className="flex flex-col gap-5 p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-zinc-700">
          メニュー名
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={state.values.name}
          placeholder="例: カット＋カラー"
          // text-base(16px以上)にしているのは、iOSでinput/textareaにフォーカスした際に
          // ブラウザが自動でズームしてしまうのを防ぐため（14px未満だと発生しやすい）。
          className="min-h-11 rounded-lg border border-zinc-300 px-4 text-base focus:border-zinc-500 focus:outline-none"
        />
        {state.fieldErrors?.name ? (
          <p className="text-sm text-red-600">{state.fieldErrors.name}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="price" className="text-sm font-medium text-zinc-700">
          価格（円）
        </label>
        <input
          id="price"
          name="price"
          type="text"
          // inputMode="numeric" でスマホは数字専用キーパッドを出す（あくまで
          // キーボードのヒントで入力自体は制限しない）。厳密な検証はサーバー側の
          // normalizePriceInput()/parsePrice() が担う。
          // 注意: pattern="[0-9]*" は付けないこと。ブラウザの制約検証
          // （HTML5 Constraint Validation）が全角数字やカンマを含む値を
          // 「不一致」として送信前にブロックしてしまい、全角・カンマを
          // サーバー側で正規化して受け付ける、という方針が機能しなくなる。
          inputMode="numeric"
          defaultValue={state.values.price}
          placeholder="例: 5000"
          className="min-h-11 rounded-lg border border-zinc-300 px-4 text-base focus:border-zinc-500 focus:outline-none"
        />
        {state.fieldErrors?.price ? (
          <p className="text-sm text-red-600">{state.fieldErrors.price}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="description"
          className="text-sm font-medium text-zinc-700"
        >
          説明（任意）
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={state.values.description}
          placeholder="例: 髪質に合わせたカラーとカットのセットメニューです。"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-base focus:border-zinc-500 focus:outline-none"
        />
        {state.fieldErrors?.description ? (
          <p className="text-sm text-red-600">
            {state.fieldErrors.description}
          </p>
        ) : null}
      </div>

      <label className="flex min-h-11 items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={state.values.isActive}
          className="h-5 w-5 rounded border-zinc-300"
        />
        お客様向けに表示する
      </label>

      {!state.ok && state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="min-h-11 rounded-lg bg-zinc-900 px-4 text-base font-medium text-white disabled:opacity-50"
      >
        {isPending ? "保存中…" : submitLabel}
      </button>
    </form>
  );
}
