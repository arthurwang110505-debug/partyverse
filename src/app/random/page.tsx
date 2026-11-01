import type { Metadata } from "next";
import { isPlayModeId } from "@/constants/playModes";
import RandomPartyClient from "./RandomPartyClient";

export const metadata: Metadata = {
  title: "隨機派對模式 — 快閃、正常、最久、決戰",
  description:
    "選一個時間盒，或挑戰 8 款隨機遊戲的決戰模式。每款玩完接著下一款，決戰總排名在八款全部完成後公布。",
};

interface Props {
  searchParams: { mode?: string; players?: string };
}

export default function RandomPartyPage({ searchParams }: Props) {
  const players = Number(searchParams.players);
  return (
    <RandomPartyClient
      initialMode={isPlayModeId(searchParams.mode) ? searchParams.mode : undefined}
      initialPlayerCount={Number.isFinite(players) && players >= 2 && players <= 20 ? players : undefined}
    />
  );
}
