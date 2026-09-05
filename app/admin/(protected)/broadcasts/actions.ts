"use server";

// お知らせ一斉配信のServer Action。
//
// 重要: Server Action はページを経由せず直接 POST でも呼び出せる
// （Next.js公式ドキュメントに明記）。proxy.ts のガードだけに頼らず、
// 各Actionの先頭で必ず requireAdminSession() を呼ぶ。
//
// 一斉配信は取り消せない操作なので、他のCUD系Actionより慎重にしている:
// - sendBroadcastAction は失敗してもredirectせず、入力文面を保持したまま
//   state でエラーを返す（すぐ再送できるように）。
// - sendTestBroadcastAction はテスト送信専用。broadcasts テーブルには
//   記録しない（本番配信の履歴ではないため）。

import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin/guard";
import { getLineTestUserId } from "@/lib/env";
import { broadcastText, pushText } from "@/lib/line/client";
import { recordBroadcast } from "@/lib/broadcasts/admin";

export type BroadcastFormValues = {
  message: string;
};

export type BroadcastFormState = {
  ok: boolean;
  error?: string;
  // 成功時のインライン通知（例: テスト送信しました）。errorとは別の緑表示に使う。
  notice?: string;
  fieldErrors?: Partial<Record<"message", string>>;
  values: BroadcastFormValues;
};

// LINEのテキストメッセージの実際の上限（lib/line/client.tsのMAX_TEXT_LENGTHと同じ値）。
// bot自動応答と違い、管理者が書いた文面を黙って切り詰めると誤解を招くため、
// ここでは超過をエラーとして弾く（sliceはしない）。
const MESSAGE_MAX_LENGTH = 5000;

type ParsedBroadcastForm =
  | { ok: true; message: string }
  | {
      ok: false;
      fieldErrors: NonNullable<BroadcastFormState["fieldErrors"]>;
      values: BroadcastFormValues;
    };

function parseBroadcastForm(formData: FormData): ParsedBroadcastForm {
  const message = String(formData.get("message") ?? "").trim();
  const values: BroadcastFormValues = { message };
  const fieldErrors: NonNullable<BroadcastFormState["fieldErrors"]> = {};

  if (message.length === 0) {
    fieldErrors.message = "配信する文面を入力してください。";
  } else if (message.length > MESSAGE_MAX_LENGTH) {
    fieldErrors.message = `文面は${MESSAGE_MAX_LENGTH}文字以内で入力してください。`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, values };
  }

  return { ok: true, message };
}

/**
 * 友だち全員に一斉配信する。取り消せないので呼び出し元（BroadcastForm）で
 * 必ず確認ステップを経由させること。
 */
export async function sendBroadcastAction(
  _prevState: BroadcastFormState,
  formData: FormData,
): Promise<BroadcastFormState> {
  await requireAdminSession();

  const parsed = parseBroadcastForm(formData);
  if (!parsed.ok) {
    return {
      ok: false,
      fieldErrors: parsed.fieldErrors,
      values: parsed.values,
    };
  }

  try {
    await broadcastText(parsed.message);
  } catch (e) {
    // 生のDBエラーと同様、生のLINE APIエラーもユーザーには見せず汎用メッセージ。
    // ただし詳細はerror_detailとして履歴に残し、あとで管理者が読めるようにする。
    console.error("[sendBroadcastAction] 配信に失敗しました", e);
    try {
      await recordBroadcast({
        message: parsed.message,
        status: "failed",
        errorDetail: String(e),
      });
    } catch (recordError) {
      // 履歴保存の失敗で「配信自体は失敗した」という事実を握りつぶさない。
      console.error(
        "[sendBroadcastAction] 失敗履歴の記録にも失敗しました",
        recordError,
      );
    }
    // redirectしない: 入力文面を保持したまま確認画面に留まり、すぐ再送できるようにする。
    return {
      ok: false,
      error: "配信に失敗しました。時間をおいて再度お試しください。",
      values: { message: parsed.message },
    };
  }

  try {
    await recordBroadcast({
      message: parsed.message,
      status: "sent",
      errorDetail: null,
    });
  } catch (e) {
    // 配信自体は成功しているので、履歴保存の失敗でユーザーに「失敗した」とは伝えない。
    // ログだけ残す（配信成功の事実より優先度は下）。
    console.error("[sendBroadcastAction] 成功履歴の記録に失敗しました", e);
  }

  redirect("/admin/broadcasts?sent=1");
}

/**
 * 自分のLINEにだけ送るテスト送信。LINE_TEST_USER_ID未設定なら弾く
 * （UI側でもボタンを出していないが、Server Actionは直接POSTでも呼べるため多重防御）。
 * 成功・失敗どちらもredirectせず、入力文面を保持したままインラインで結果を返す。
 * broadcastsテーブルには記録しない（本番配信の履歴ではないため）。
 */
export async function sendTestBroadcastAction(
  _prevState: BroadcastFormState,
  formData: FormData,
): Promise<BroadcastFormState> {
  await requireAdminSession();

  const testUserId = getLineTestUserId();
  const parsed = parseBroadcastForm(formData);
  if (!parsed.ok) {
    return {
      ok: false,
      fieldErrors: parsed.fieldErrors,
      values: parsed.values,
    };
  }

  if (!testUserId) {
    return {
      ok: false,
      error:
        "LINE_TEST_USER_IDが未設定です。.env.localに自分のLINE user idを設定してください。",
      values: { message: parsed.message },
    };
  }

  try {
    await pushText(testUserId, parsed.message);
  } catch (e) {
    console.error("[sendTestBroadcastAction] テスト送信に失敗しました", e);
    return {
      ok: false,
      error: "テスト送信に失敗しました。時間をおいて再度お試しください。",
      values: { message: parsed.message },
    };
  }

  return {
    ok: true,
    notice: "テスト送信しました。自分のLINEを確認してください。",
    values: { message: parsed.message },
  };
}
