import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Investment OS", description: "Evidence-bound investment decision review" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><a className="skip-link" href="#main">본문으로 건너뛰기</a>{children}</body></html>;
}
