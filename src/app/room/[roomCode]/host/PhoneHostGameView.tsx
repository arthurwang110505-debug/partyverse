"use client";

import { useEffect, useRef, useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { RULES_PHASE } from "@/engine/rulesTour";
import { hostIsPlaying, initialPhoneHostTab, type PhoneHostTab } from "@/lib/hostMode";
import { PhoneHostChrome } from "@/components/game/PhoneHostChrome";
import HostGameView from "./HostGameView";
import PlayGameView from "../play/PlayGameView";

/**
 * The host tab for a phone-hosted room.
 *
 * A phone has no second screen, so the stage and the host's own controller
 * share one tab. Both halves are the *same* mounted route: only one is visible
 * at a time, and the game clock keeps running in the provider either way.
 */
export default function PhoneHostGameView() {
  const { room } = useRoom();
  const canPlay = hostIsPlaying(room);
  const [tab, setTab] = useState<PhoneHostTab>(() => initialPhoneHostTab(room));
  const phase = room?.gameState?.phase;
  const previousPhase = useRef(phase);

  // The briefing asks the host for their own confirmation ("我看懂了"), which
  // only exists on the controller. Entering the briefing flips there, leaving
  // it flips back to the stage — but the host's manual choice wins at any
  // other moment.
  useEffect(() => {
    if (previousPhase.current === phase) return;
    if (phase === RULES_PHASE) setTab("controller");
    else if (previousPhase.current === RULES_PHASE) setTab("stage");
    previousPhase.current = phase;
  }, [phase]);

  // A presenting host has nothing to control.
  const activeTab: PhoneHostTab = canPlay ? tab : "stage";

  const changeTab = (next: PhoneHostTab) => {
    if (!canPlay) return;
    setTab(next);
    // Both panes are short; starting the other one at the same scroll offset
    // looks like the page jumped.
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  return (
    <PhoneHostChrome tab={activeTab} onTabChange={changeTab}>
      {/* The attribute makes "which half is showing" observable to tests and to
          assistive tech, without inventing a second route. */}
      <div data-phone-host-tab={activeTab}>
        {activeTab === "stage" ? <HostGameView /> : <PlayGameView />}
      </div>
    </PhoneHostChrome>
  );
}
