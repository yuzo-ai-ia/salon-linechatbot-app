import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "美容室 LINE bot",
  description: "個人美容室オーナー向け LINE 問い合わせ自動応答 bot",
};

// 管理画面はライトモード前提のzinc/greige配色で設計している。OS/ブラウザが
// ダークモード設定でも常にライトで描画させるため（colorSchemeはNext.js 16では
// metadataではなくviewportエクスポート側のAPI）。
export const viewport: Viewport = {
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
