import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";

export const metadata: Metadata = { title: "상품 가이드" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ko" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>;
}
