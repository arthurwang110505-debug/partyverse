"use client";

import type { ComponentType } from "react";
import { RULES_PHASE } from "@/engine/rulesTour";
import { useRoom } from "@/providers/RoomContext";
import { HostShell } from "@/components/game/HostShell";
import { RulesTour } from "@/components/game/RulesTour";
import HostBombCountdown from "./views/HostBombCountdown";
import HostEverybodyKnows from "./views/HostEverybodyKnows";
import HostAiBullshit from "./views/HostAiBullshit";
import HostUndercover from "./views/HostUndercover";
import HostSong3Seconds from "./views/HostSong3Seconds";
import HostKingTonight from "./views/HostKingTonight";
import HostFireworkMaster from "./views/HostFireworkMaster";
import HostDrawAndGuess from "./views/HostDrawAndGuess";
import HostRealBattle from "./views/HostRealBattle";
import HostMysteryRoom from "./views/HostMysteryRoom";
import HostMusicalChairs from "./views/HostMusicalChairs";
import HostWhackMoles from "./views/HostWhackMoles";
import HostSimonSays from "./views/HostSimonSays";
import HostWordChain from "./views/HostWordChain";
import HostPokerLite from "./views/HostPokerLite";

const VIEWS: Record<string, ComponentType> = {
  bombcountdown: HostBombCountdown,
  everybodyknows: HostEverybodyKnows,
  aibullshit: HostAiBullshit,
  whoisundercoveragent: HostUndercover,
  song3seconds: HostSong3Seconds,
  kingtonight: HostKingTonight,
  fireworkmaster: HostFireworkMaster,
  drawandguess: HostDrawAndGuess,
  realbattle: HostRealBattle,
  mysteryroom: HostMysteryRoom,
  musicalchairs: HostMusicalChairs,
  whackmoles: HostWhackMoles,
  simonsays: HostSimonSays,
  wordchain: HostWordChain,
  pokerlite: HostPokerLite,
};

/** Dispatch first: never interpret another game's state as bomb state. */
export default function HostGameView() {
  const { room } = useRoom();
  if (!room) return null;
  if ((room.gameState as { phase?: string } | undefined)?.phase === RULES_PHASE) {
    return <RulesTour variant="host" />;
  }
  const View = VIEWS[room.gameId];
  return View ? (
    <View />
  ) : (
    <HostShell>
      <p role="alert">找不到這個遊戲，請回大廳重新選擇。</p>
    </HostShell>
  );
}
