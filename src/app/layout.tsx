import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "PARITY — See the gap", template: "%s | PARITY" },
  description: "See how Stock Tokens diverge from the underlying market. Live price comparison for Robinhood Chain.",
  openGraph: { title: "PARITY — See the gap", description: "See how Stock Tokens diverge from the underlying market.", siteName: "PARITY", type: "website", images: ["/api/og"] },
  twitter: { card: "summary_large_image", title: "PARITY — See the gap", description: "See how Stock Tokens diverge from the underlying market.", images: ["/api/og"] },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Providers>{children}</Providers></body></html>;
}
