import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/providers/Providers";
import "./globals.css";

/**
 * Inter, self-hosted as a single variable WOFF2 (weights 100–900, latin).
 *
 * This used to be `Inter` from `next/font/google` with seven static weights,
 * which (a) made `next build` fail outright whenever fonts.googleapis.com was
 * unreachable — including in CI — and (b) shipped seven files instead of one.
 */
const inter = localFont({
  src: "../../public/fonts/InterVariable-latin.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "100 900",
  style: "normal",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const title = "PARTYVERSE — 一間房，十款遊戲，無限混亂";
const description =
  "多人派對遊戲平台。用手機加入房間，電視當主畫面，和朋友即時同樂。Bomb Countdown 現已開放。";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s — PARTYVERSE",
  },
  description,
  applicationName: "PARTYVERSE",
  keywords: ["派對遊戲", "多人遊戲", "party game", "multiplayer", "bomb countdown", "破冰遊戲"],
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "PARTYVERSE",
    title,
    description,
    locale: "zh_HANT",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#050508",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" className={inter.variable}>
      <body className="min-h-screen bg-ink text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
