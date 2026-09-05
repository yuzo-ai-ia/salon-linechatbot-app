// LINE webhook が送ってくる JSON の型。
//
// 公式のイベント種類は多い（message / follow / postback / beacon ...）が、
// 今フェーズで扱うのはテキストメッセージだけ。必要な分だけを定義し、
// 実際の絞り込み（type や必須フィールドの有無）はハンドラ側で行う。
// SDK を入れずに済ませるための最小限の型。
// type / message.type は当初 string にしていたが、タイポをコンパイル時に
// 検知できるようリテラルの Union 型（LineEventType / LineMessageType）にした。

/** webhook リクエストボディ全体。 */
export type LineWebhookBody = {
  destination: string;
  events: LineEvent[];
};

/**
 * LINE 公式ドキュメントに載っているイベント種類（今回扱わない follow 等も含めて列挙）。
 * `string` のままだと `event.type !== "message"` のような比較でタイポしても
 * コンパイルが通ってしまう（実害は薄いが気づきにくい）ため、リテラルの Union にした。
 * これは JSON.parse の結果に対する型注釈（`as LineWebhookBody`）であり実行時の
 * 検証ではないので、ここに無い値が実際に飛んできても実行時エラーにはならない
 * （`handleEvent` 側は `!== "message"` で弾くだけなので安全）。
 */
export type LineEventType =
  | "message"
  | "follow"
  | "unfollow"
  | "join"
  | "leave"
  | "memberJoined"
  | "memberLeft"
  | "postback"
  | "videoPlayComplete"
  | "beacon"
  | "accountLink"
  | "things";

/** LINE 公式ドキュメントに載っているメッセージ種類。今回扱うのは "text" のみ。 */
export type LineMessageType =
  "text" | "image" | "video" | "audio" | "file" | "location" | "sticker";

/** 個々のイベント。今回参照しないフィールドは省略している。 */
export type LineEvent = {
  type: LineEventType;
  /** 返信に使うトークン。message / follow 等では付くが、種類により無い。 */
  replyToken?: string;
  source?: {
    type: string;
    /** 1:1 トークなら送信者の userId が入る。グループ等では無いことがある。 */
    userId?: string;
  };
  message?: {
    id: string;
    type: LineMessageType;
    /** message.type === "text" のときだけ入る。 */
    text?: string;
  };
};
