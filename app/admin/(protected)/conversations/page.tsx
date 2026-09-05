// 会話ログ一覧（読み取り専用）。
//
// conversations は LINE メッセージ1件＝1行で際限なく増え続けるため、
// menus/faq のような全件取得はせず、listRecentConversations() が
// 直近50件だけを返す設計にしている（lib/conversations/admin.ts参照）。
// 追加・編集・削除は無いので actions.ts も作らない。

import { requireAdminSession } from "@/lib/admin/guard";
import {
  listRecentConversations,
  type ConversationAdminRow,
} from "@/lib/conversations/admin";

// サーバーの実行環境がJSTとは限らないため、表示はAsia/Tokyoを明示する
// （timestamptzはUTCで持っているので、指定しないとサーバーのタイムゾーン
// 次第で表示がずれる）。
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatConfidence(confidence: number | null): string {
  if (confidence === null) return "—";
  return `${Math.round(confidence * 100)}%`;
}

export default async function ConversationListPage() {
  // proxy.ts でもガードしているが、FAQ/menus側と同じ多重防御方針でページ側でも確認する。
  await requireAdminSession();

  let conversations: ConversationAdminRow[] = [];
  let loadError: string | null = null;
  try {
    conversations = await listRecentConversations();
  } catch (e) {
    // 生のDBエラーは画面に出さず、ログにだけ残す（FAQ/menus側と同方針）。
    console.error("[ConversationListPage] 会話ログの取得に失敗しました", e);
    loadError =
      "会話ログの読み込みに失敗しました。時間をおいて再度お試しください。";
  }

  return (
    <div className="mx-auto max-w-xl pb-8">
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-zinc-500">
          直近{conversations.length}件を新しい順に表示しています。
        </p>

        {loadError ? (
          <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {loadError}
          </p>
        ) : conversations.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            まだ会話ログがありません。
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {conversations.map((conversation) => (
              <li
                key={conversation.id}
                className="rounded-lg border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-zinc-500">
                    {formatDateTime(conversation.created_at)}
                  </p>
                  {conversation.needs_human ? (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                      要対応
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-sm font-medium text-zinc-900">
                  {conversation.received_message}
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  {conversation.bot_response ?? "（回答なし）"}
                </p>

                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-400">
                  <span className="truncate">{conversation.line_user_id}</span>
                  <span>
                    confidence: {formatConfidence(conversation.confidence)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
