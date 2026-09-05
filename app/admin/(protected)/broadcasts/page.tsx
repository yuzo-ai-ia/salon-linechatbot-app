// お知らせ一斉配信。上部に入力〜確認フォーム、下部に配信履歴（読み取り専用）。
//
// 一斉配信は取り消せない操作なので、送信は必ずBroadcastForm側の
// プレビュー確認ステップを経由する（このページ自体はフォームを置くだけ）。

import { requireAdminSession } from "@/lib/admin/guard";
import { getLineTestUserId } from "@/lib/env";
import { BroadcastForm } from "@/components/BroadcastForm";
import {
  listRecentBroadcasts,
  type BroadcastAdminRow,
} from "@/lib/broadcasts/admin";

function formatDateTime(iso: string): string {
  // 会話ログ一覧と同じ理由（サーバーの実行環境がJSTとは限らない）でAsia/Tokyoを明示。
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function BroadcastPage(
  props: PageProps<"/admin/broadcasts">,
) {
  // proxy.ts でもガードしているが、他画面と同じ多重防御方針でページ側でも確認する。
  await requireAdminSession();

  const searchParams = await props.searchParams;
  const hasTestUserId = getLineTestUserId() !== null;

  let broadcasts: BroadcastAdminRow[] = [];
  let loadError: string | null = null;
  try {
    broadcasts = await listRecentBroadcasts();
  } catch (e) {
    console.error("[BroadcastPage] 配信履歴の取得に失敗しました", e);
    loadError =
      "配信履歴の読み込みに失敗しました。時間をおいて再度お試しください。";
  }

  return (
    <div className="mx-auto max-w-xl pb-8">
      {searchParams.sent ? (
        <div className="p-4 pb-0">
          <p className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
            配信しました。
          </p>
        </div>
      ) : null}

      <BroadcastForm hasTestUserId={hasTestUserId} />

      <div className="flex flex-col gap-3 border-t border-zinc-200 p-4">
        <p className="text-sm font-medium text-zinc-700">配信履歴</p>

        {loadError ? (
          <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {loadError}
          </p>
        ) : broadcasts.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            まだ配信履歴がありません。
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {broadcasts.map((broadcast) => (
              <li
                key={broadcast.id}
                className="rounded-lg border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-zinc-500">
                    {formatDateTime(broadcast.created_at)}
                  </p>
                  {broadcast.status === "sent" ? (
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                      成功
                    </span>
                  ) : (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                      失敗
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-zinc-900">
                  {broadcast.message}
                </p>
                {broadcast.status === "failed" && broadcast.error_detail ? (
                  <p className="mt-1 line-clamp-2 text-xs text-red-600">
                    {broadcast.error_detail}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
