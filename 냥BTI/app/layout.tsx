import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppRuntimeBridge } from "@/components/AppRuntimeBridge";
import "./globals.scss";
import "./pages.scss";

export const metadata: Metadata = {
  title: "냥BTI · 우리 고양이 행동 성향 테스트",
  description:
    "30가지 일상 행동으로 알아보는 우리 고양이의 6가지 성향과 냥BTI",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f3ed",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <AppRuntimeBridge />
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
