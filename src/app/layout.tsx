import { Providers } from "@/providers/Providers";
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "PARTYVERSE — One Room. Ten Games. Infinite Chaos.",
  description: "Multiplayer party game platform. Play with friends in real-time.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[#050508] text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
