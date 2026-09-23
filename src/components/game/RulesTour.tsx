"use client";

import { useState } from "react";
import { GAMES } from "@/constants/games";
import { GAME_GUIDES } from "@/constants/gameGuides";
import { connectedParticipantIds } from "@/engine/participants";
import type { RulesState } from "@/engine/rulesTour";
import { useRoom } from "@/providers/RoomContext";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { HostGameControls } from "./HostGameControls";
import { HostShell } from "./HostShell";
import { PlayShell } from "./PlayShell";
import { cn } from "@/lib/utils";

export function RulesTour({ variant }: { variant: "host" | "play" }) {
  const { room, player, isHost, submitAction } = useRoom();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const game = GAMES.find((g) => g.id === room?.gameId);
  const guide = game && GAME_GUIDES[game.id];
  if (!room || !game || !guide) return null;
  const state = room.gameState as RulesState;
  const ids = connectedParticipantIds(room);
  const ready = ids.filter((id) => state.rulesReady?.[id]);
  const meReady = !!state.rulesReady?.[player?.id ?? ""];
  const phone = variant === "play";
  const Shell = phone ? PlayShell : HostShell;
  const send = async (type: "readyRules" | "skipRules") => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await submitAction({ type });
    } catch (e) {
      setError(e instanceof Error ? e.message : "未能送出，請再試一次");
    } finally {
      setPending(false);
    }
  };

  return (
    <Shell>
      <section className={cn("mx-auto flex max-w-3xl flex-col items-center py-6 text-center", !phone && "md:py-10")}>
        <p className={phone ? "text-5xl" : "text-7xl"} aria-hidden="true">
          {game.icon}
        </p>
        <p className="mb-2 mt-4 text-xs font-bold tracking-[0.3em] text-violet-300">一起看懂，再開始</p>
        <h1 className={cn("font-black text-white", phone ? "text-3xl" : "text-5xl")}>{game.name}</h1>
        <dl className="mt-6 grid w-full gap-3 text-left">
          {[
            ["01", "你的目標", guide.goal],
            ["02", "怎麼操作", guide.controls],
            ["03", "怎麼得分", guide.scoring],
          ].map(([number, title, text]) => (
            <div key={number} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
              <span aria-hidden="true" className="text-sm font-black tabular-nums text-violet-300">
                {number}
              </span>
              <div>
                <dt className="mb-1 text-xs font-bold tracking-widest text-white/60">{title}</dt>
                <dd className={cn("leading-relaxed text-white/90", phone ? "text-sm" : "text-xl")}>{text}</dd>
              </div>
            </div>
          ))}
        </dl>
        <div className="mt-6 w-full rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4">
          <p role="status" className="font-bold text-violet-200">
            {ready.length} / {ids.length} 位玩家已看懂
          </p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2" aria-label="規則準備狀態">
            {ids.map((id) => (
              <li
                key={id}
                className={cn(
                  "rounded-full px-3 py-1 text-xs",
                  state.rulesReady?.[id] ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-white/70",
                )}
              >
                {state.rulesReady?.[id] ? "✓" : "○"} {room.players[id].nickname}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-white/65">
            不倒數催促。全員看懂後自動開始，房主也可以提前開玩。
          </p>
        </div>
        <ErrorNote className="mt-4 w-full">{error}</ErrorNote>
        <div className="mt-4 flex w-full flex-col gap-3 sm:max-w-sm">
          {phone && ids.includes(player?.id ?? "") && (
            <Button
              variant="primary"
              size="lg"
              loading={pending}
              disabled={meReady}
              onClick={() => void send("readyRules")}
            >
              {meReady ? "已看懂，等大家一起開始" : "我看懂了，準備好了"}
            </Button>
          )}
          {isHost && (
            <Button size="lg" onClick={() => void send("skipRules")} loading={pending}>
              房主開始遊戲 →
            </Button>
          )}
        </div>
        {!phone && <HostGameControls />}
      </section>
    </Shell>
  );
}
