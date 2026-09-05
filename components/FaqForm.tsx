"use client";

// FAQ の追加・編集で共有するフォーム。
// useActionState で「送信中の表示」「バリデーションエラー」「入力値の保持」を
// まとめて扱う（エラーで差し戻された時に入力し直させない = スマホでの
// 再入力の手間を減らすため）。

import { useActionState } from "react";
import { FAQ_CATEGORY_OPTIONS } from "@/lib/faq/categories";
import type {
  FaqFormState,
  FaqFormValues,
} from "@/app/admin/(protected)/faq/actions";

type Props = {
  action: (
    prevState: FaqFormState,
    formData: FormData,
  ) => Promise<FaqFormState>;
  initialValues: FaqFormValues;
  submitLabel: string;
};

export function FaqForm({ action, initialValues, submitLabel }: Props) {
  const [state, formAction, isPending] = useActionState(action, {
    ok: true,
    values: initialValues,
  });

  return (
    <form action={formAction} className="flex flex-col gap-5 p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="category" className="text-sm font-medium text-zinc-700">
          カテゴリ
        </label>
        <select
          id="category"
          name="category"
          defaultValue={state.values.category}
          className="min-h-11 rounded-lg border border-zinc-300 bg-white px-4 text-base focus:border-greige-500 focus:outline-none"
        >
          {FAQ_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {state.fieldErrors?.category ? (
          <p className="text-sm text-red-600">{state.fieldErrors.category}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="question" className="text-sm font-medium text-zinc-700">
          質問
        </label>
        <textarea
          id="question"
          name="question"
          rows={2}
          defaultValue={state.values.question}
          placeholder="例: 営業時間は何時から何時までですか？"
          // text-base(16px以上)にしているのは、iOSでinput/textareaにフォーカスした際に
          // ブラウザが自動でズームしてしまうのを防ぐため（14px未満だと発生しやすい）。
          className="min-h-11 rounded-lg border border-zinc-300 px-4 py-2 text-base focus:border-greige-500 focus:outline-none"
        />
        {state.fieldErrors?.question ? (
          <p className="text-sm text-red-600">{state.fieldErrors.question}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="answer" className="text-sm font-medium text-zinc-700">
          回答
        </label>
        <textarea
          id="answer"
          name="answer"
          rows={5}
          defaultValue={state.values.answer}
          placeholder="例: 営業時間は10:00〜19:00です。"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-base focus:border-greige-500 focus:outline-none"
        />
        {state.fieldErrors?.answer ? (
          <p className="text-sm text-red-600">{state.fieldErrors.answer}</p>
        ) : null}
      </div>

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
        className="min-h-11 rounded-lg bg-greige-800 px-4 text-base font-medium text-white disabled:opacity-50"
      >
        {isPending ? "保存中…" : submitLabel}
      </button>
    </form>
  );
}
