import type { Metadata, Viewport } from "next";
import { Noto_Sans_TC } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans_TC({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
  fallback: ["PingFang TC", "Microsoft JhengHei", "WenQuanYi Micro Hei", "sans-serif"],
});

export const metadata: Metadata = {
  title: "揮拍鏡",
  description: "影低或上傳正手、反手揮拍，對比自己同矯正骨架，並用廣東話睇建議。",
};

export const viewport: Viewport = {
  themeColor: "#070b12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body className={`${noto.className} antialiased`}>{children}</body>
    </html>
  );
}
