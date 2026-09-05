"use client";

// お知らせ一斉配信の入力〜確認フォーム。
//
// FaqForm/MenuFormのuseActionStateパターンと違い、削除確認画面のように
// 「本文を打ち込んだ直後に、まだ保存されていない内容そのものをプレビューして
// 確認させる」必要がある。DBに下書き行を作ってから確認画面へ遷移する方式は
// 後片付け（未送信の下書きが残る）が面倒なので、ページ遷移せずcomposeフェーズ/
// confirmフェーズをクライアント側のstateだけで切り替える設計にしている。

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  sendBroadcastAction,
  sendTestBroadcastAction,
  type BroadcastFormState,
} from "@/app/admin/(protected)/broadcasts/actions";

const INITIAL_STATE: BroadcastFormState = { ok: true, values: { message: "" } };

type Props = {
  // LINE_TEST_USER_ID が設定されているか（サーバー側でしか判定できないため props で受け取る）。
  hasTestUserId: boolean;
};

export function BroadcastForm({ hasTestUserId }: Props) {
  const [phase, setPhase] = useState<"compose" | "confirm">("compose");
  const [message, setMessage] = useState("");
  const [composeError, setComposeError] = useState<string | null>(null);

  const [sendState, sendFormAction] = useActionState(
    sendBroadcastAction,
    INITIAL_STATE,
  );
  const [testState, testFormAction] = useActionState(
    sendTestBroadcastAction,
    INITIAL_STATE,
  );

  function handleProceedToConfirm() {
    if (message.trim().length === 0) {
      setComposeError("配信する文面を入力してください。");
      return;
    }
    setComposeError(null);
    setPhase("confirm");
  }

  if (phase === "compose") {
    return (
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="broadcast-message"
            className="text-sm font-medium text-zinc-700"
          >
            お知らせ本文
          </label>
          <textarea
            id="broadcast-message"
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="例: 9/15（月）は臨時休業とさせていただきます。ご迷惑をおかけしますが、よろしくお願いいたします。"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-base focus:border-zinc-500 focus:outline-none"
          />
          {composeError ? (
            <p className="text-sm text-red-600">{composeError}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleProceedToConfirm}
          className="min-h-11 rounded-lg bg-zinc-900 px-4 text-base font-medium text-white"
        >
          プレビューを確認
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <p className="text-sm font-medium text-zinc-700">プレビュー</p>
        <div className="mt-1 whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-900">
          {message}
        </div>
      </div>

      <p
        role="alert"
        className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700"
      >
        配信すると取り消せません。内容をよく確認してください。
      </p>

      {hasTestUserId ? (
        <form action={testFormAction} className="flex flex-col gap-1">
          <input type="hidden" name="message" value={message} />
          <FormSubmitButton
            label="テスト送信（自分のLINEにのみ届きます）"
            pendingLabel="送信中…"
            className="border border-zinc-300 bg-white text-zinc-700"
          />
          {!testState.ok && testState.error ? (
            <p className="text-sm text-red-600">{testState.error}</p>
          ) : null}
          {testState.ok && testState.notice ? (
            <p className="text-sm text-green-700">{testState.notice}</p>
          ) : null}
        </form>
      ) : (
        <p className="text-xs text-zinc-500">
          LINE_TEST_USER_IDが未設定のため、テスト送信は使えません
          （.env.localに自分のLINE user idを設定すると使えるようになります）。
        </p>
      )}

      <form action={sendFormAction} className="flex flex-col gap-1">
        <input type="hidden" name="message" value={message} />
        <FormSubmitButton
          label="配信する（友だち全員）"
          pendingLabel="配信中…"
          className="bg-red-600 text-white"
        />
        {!sendState.ok && sendState.error ? (
          <p className="text-sm text-red-600">{sendState.error}</p>
        ) : null}
      </form>

      <button
        type="button"
        onClick={() => setPhase("compose")}
        className="flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 text-base font-medium text-zinc-700"
      >
        編集に戻る
      </button>
    </div>
  );
}

// 送信中はdisabled + 文言切り替え（DeleteConfirmButtonと同じ二重送信防止パターン）。
// テスト送信・本番配信の両方で使うため、見た目をpropsで差し替えられるようにしている。
function FormSubmitButton({
  label,
  pendingLabel,
  className,
}: {
  label: string;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-base font-medium disabled:opacity-50 ${className}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
