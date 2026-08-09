import type { Metadata } from "next";
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
  title: "Atomize — AI App Builder",
  description: "Turn one clear idea into an interactive, persistent web app with a visible AI agent workflow.",
  openGraph: {
    title: "Atomize — AI App Builder",
    description: "Describe an idea, watch four agents shape it, and use the generated app immediately.",
    images: [{ url: "/og-image.png", width: 1536, height: 1024, alt: "Atomize AI app builder" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Atomize — AI App Builder",
    description: "An interactive, persistent agent-driven app generator.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
