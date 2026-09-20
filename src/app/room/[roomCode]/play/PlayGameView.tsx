"use client";

import type { ComponentType } from "react";
import { useRoom } from "@/providers/RoomContext";
import { PlayShell } from "@/components/game/PlayShell";
import { participantIds } from "@/engine/participants";
import PlayBombCountdown from "./views/PlayBombCountdown";
import PlayEverybodyKnows from "./views/PlayEverybodyKnows";
import PlayAiBullshit from "./views/PlayAiBullshit";
import PlayUndercover from "./views/PlayUndercover";
import PlaySong3Seconds from "./views/PlaySong3Seconds";
import PlayKingTonight from "./views/PlayKingTonight";
import PlayFireworkMaster from "./views/PlayFireworkMaster";
import PlayDrawAndGuess from "./views/PlayDrawAndGuess";
import PlayRealBattle from "./views/PlayRealBattle";
import PlayMysteryRoom from "./views/PlayMysteryRoom";

const VIEWS: Record<string, ComponentType> = {
  bombcountdown: PlayBombCountdown,
  everybodyknows: PlayEverybodyKnows,
  aibullshit: PlayAiBullshit,
  whoisundercoveragent: PlayUndercover,
  song3seconds: PlaySong3Seconds,
  kingtonight: PlayKingTonight,
  fireworkmaster: PlayFireworkMaster,
  drawandguess: PlayDrawAndGuess,
  realbattle: PlayRealBattle,
  mysteryroom: PlayMysteryRoom,
};

/** Dispatch first: never interpret another game's state as bomb state. */
export default function PlayGameView() {
  const { room, player } = useRoom();
  if (!room || !player) return null;
  if (!participantIds(room).includes(player.id))
    return (
      <PlayShell>
        <section className="py-12 text-center" role="status">
          <p className="mb-4 text-5xl" aria-hidden="true">
            👀
          </p>
          <h1 className="text-2xl font-bold">本場先當觀眾</h1>
          <p className="mt-3 text-sm text-white/70">遊戲已經開始。下一場回到大廳時，你就能一起加入！</p>
        </section>
      </PlayShell>
    );
  const View = VIEWS[room.gameId];
  return View ? (
    <View />
  ) : (
    <PlayShell>
      <p role="alert">找不到這個遊戲，請回大廳重新選擇。</p>
    </PlayShell>
  );
}
