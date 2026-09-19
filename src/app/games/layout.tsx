import type { Metadata } from "next";
import { GAMES } from "@/constants/games";
import { playableGameIds } from "@/engine";

/**
 * `games/page.tsx` is a client component (it owns the search/filter state), and
 * client components cannot export `metadata` — so the metadata lives here.
 */
export const metadata: Metadata = {
  title: "全部遊戲",
  description: `瀏覽 ${GAMES.length} 款為團體設計的派對遊戲，目前已有 ${playableGameIds().length} 款開放遊玩。`,
  openGraph: {
    title: "全部遊戲 — PARTYVERSE",
    description: `${GAMES.length} 款派對遊戲：心理戰、塗鴉猜題、投票、音樂搶答。掃 QR code 就能和朋友一起玩。`,
  },
};

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
