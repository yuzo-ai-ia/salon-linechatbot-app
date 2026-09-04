// LINE webhook が送ってくる JSON の型。
//
// 公式のイベント種類は多い（message / follow / postback / beacon ...）が、
// 今フェーズで扱うのはテキストメッセージだけ。必要な分だけをゆるく定義し、
// 実際の絞り込み（type や必須フィールドの有無）はハンドラ側で行う。
// SDK を入れずに済ませるための最小限の型。

/** webhook リクエストボディ全体。 */
export type LineWebhookBody = {
  destination: string;
  events: LineEvent[];
};

/** 個々のイベント。今回参照しないフィールドは省略している。 */
export type LineEvent = {
  type: string;
  /** 返信に使うトークン。message / follow 等では付くが、種類により無い。 */
  replyToken?: string;
  source?: {
    type: string;
    /** 1:1 トークなら送信者の userId が入る。グループ等では無いことがある。 */
    userId?: string;
  };
  message?: {
    id: string;
    type: string;
    /** message.type === "text" のときだけ入る。 */
    text?: string;
  };
};
