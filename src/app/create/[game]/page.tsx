import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GAMES } from "@/constants/games";
import { isPlayable } from "@/engine";
import CreateRoomClient from "./CreateRoomClient";

interface Props {
  params: { game: string };
}

export function generateMetadata({ params }: Props): Metadata {
  const game = GAMES.find((g) => g.id === params.game);
  if (!game) return { title: "找不到遊戲" };
  return {
    title: `建立 ${game.name} 房間`,
    description: `建立一間 ${game.name} 的派對房間，邀請朋友加入。`,
    robots: { index: false, follow: false },
  };
}

export default function CreateRoomPage({ params }: Props) {
  const game = GAMES.find((g) => g.id === params.game);
  if (!game) notFound();
  // A room for an unbuilt game would just sit on "Loading…", so don't offer one.
  if (!isPlayable(game.id)) notFound();

  return <CreateRoomClient gameId={game.id} />;
}
