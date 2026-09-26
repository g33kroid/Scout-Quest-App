import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// docs/tasks/11-bilingual.md: "An Arabic font stack that renders acceptably
// on both iOS and Android" — self-hosted via next/font (00b-cross-cutting-ui.md,
// "Self-host fonts ... font-display: swap, subset to the characters actually
// used"). Applied via [dir="rtl"] in globals.css, so it takes effect
// wherever Arabic content renders today, ahead of the full app switching
// languages.
const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Scout Quest",
  description: "Quest platform for weekly classes and camps.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansArabic.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
