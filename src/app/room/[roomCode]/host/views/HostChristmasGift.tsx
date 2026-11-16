"use client";

import { useEffect } from "react";
import { engineRoom } from "@/engine/participants";
import type { ChristmasGiftState } from "@/engine/christmasGift";
import { useRoom } from "@/providers/RoomContext";
import { useGameViewState } from "@/hooks/useGameViewState";
import { HostGameControls } from "@/components/game/HostGameControls";
import { HostShell } from "@/components/game/HostShell";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Confetti } from "@/components/game/Confetti";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";

const KIND_LABELS: Record<string, string> = {
  gold: "🌟 黃金聖誕星",
  gift: "🎁 豪華禮物",
  cookie: "🍪 暖心薑餅",
  bell: "🔔 祝福鈴鐺",
  coal: "🧦 調皮煤炭",
};

export default function HostChristmasGift() {
  const { room } = useRoom();
  const state = useGameViewState<ChristmasGiftState>();
  const players = room ? engineRoom(room).players : {};
  const phase = state?.phase;

  useEffect(() => {
    if (phase === "reveal") sfx.playJingle();
    else if (phase === "result") sfx.playFanfare();
  }, [phase]);

  if (!state) return null;

  const pickedCount = Object.keys(state.picks ?? {}).length;
  const totalPlayers = Object.keys(players).length;
  const pickTotal = Math.max(8, Math.min(30, room?.settings?.timer ?? 12));

  return (
    <HostShell>
      {state.phase === "result" && <Confetti />}

      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-950/50 px-3 py-1 text-xs font-bold tracking-wider text-emerald-300">
            🎄 聖誕限定特企 · 第 {state.currentRound} / {state.totalRounds} 回合
          </span>
          <h1 className="px-4 text-3xl font-black text-white md:text-5xl">
            {state.phase === "picking" && "🎁 挑一個聖誕禮盒！小心別撞盒！"}
            {state.phase === "reveal" && "✨ 拆禮時刻！看看誰賺翻了！"}
            {state.phase === "result" && "🎅 聖誕拆禮派對結算！"}
          </h1>
        </header>

        {/* Round twist banner */}
        {state.twist && state.phase !== "result" && (
          <div className="mx-auto mb-6 max-w-xl rounded-2xl border border-amber-400/40 bg-gradient-to-r from-red-950/60 via-emerald-950/60 to-amber-950/60 px-5 py-3 shadow-lg">
            <p className="text-sm font-black text-amber-200">
              {state.twist.icon} 本回合聖誕規則：{state.twist.title}
            </p>
            <p className="mt-1 text-xs text-white/80">{state.twist.description}</p>
          </div>
        )}

        {state.phase !== "result" && (
          <div className="mx-auto mb-6 max-w-md">
            <RoundTimer
              timeLeft={state.timeLeft}
              total={state.phase === "picking" ? pickTotal : 7}
              endLabel={state.phase === "picking" ? "同時拆禮" : "下一回合"}
            />
          </div>
        )}

        {state.phase === "picking" && (
          <div className="space-y-6">
            <p className="text-sm font-semibold text-emerald-300">
              已選擇：{pickedCount} / {totalPlayers} 位玩家
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {state.boxes.map((box) => (
                <div
                  key={box.id}
                  className="rounded-3xl border-2 bg-black/40 p-5 shadow-lg transition-transform"
                  style={{ borderColor: `${box.color}66` }}
                >
                  <p className="mb-2 text-5xl animate-bounce" aria-hidden="true">
                    {box.icon}
                  </p>
                  <p className="text-sm font-black text-white">{box.title}</p>
                  <p className="mt-1 text-[11px] text-white/50">神秘內容</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {state.phase === "reveal" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              {state.boxes.map((box) => {
                const pickers = Object.entries(state.picks ?? {})
                  .filter(([, bId]) => bId === box.id)
                  .map(([pId]) => players[pId])
                  .filter(Boolean);
                const isCoal = box.kind === "coal";
                return (
                  <div
                    key={box.id}
                    className={cn(
                      "animate-scale-in rounded-3xl border-2 p-4 text-center shadow-xl",
                      isCoal ? "border-rose-500/60 bg-rose-950/40" : "border-emerald-400/50 bg-emerald-950/30",
                    )}
                  >
                    <p className="text-4xl" aria-hidden="true">
                      {box.icon}
                    </p>
                    <p className="mt-1 text-xs font-bold text-white/70">{box.title}</p>
                    <p className="mt-2 text-sm font-black text-amber-200">{KIND_LABELS[box.kind] ?? box.kind}</p>
                    <p className={cn("text-lg font-black tabular-nums", isCoal ? "text-rose-400" : "text-emerald-300")}>
                      {box.points >= 0 ? `+${box.points}` : box.points} 分
                    </p>
                    <div className="mt-3 flex flex-wrap justify-center gap-1">
                      {pickers.length === 0 ? (
                        <span className="text-[11px] text-white/40">無人挑選</span>
                      ) : (
                        pickers.map((p) => (
                          <span
                            key={p.id}
                            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white"
                          >
                            {p.avatar} {p.nickname}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {Object.entries(players).map(([id, p]) => {
                const delta = state.roundDeltas?.[id] ?? 0;
                return (
                  <span
                    key={id}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold",
                      delta > 0
                        ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                        : delta < 0
                          ? "border-rose-400/40 bg-rose-500/15 text-rose-200"
                          : "border-white/10 bg-white/5 text-white/60",
                    )}
                  >
                    {p.avatar} {p.nickname}：{delta >= 0 ? `+${delta}` : delta}（總 {state.currentScores?.[id] ?? 0}）
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {state.phase === "result" && (
          <div className="my-8 space-y-4">
            <div className="inline-block animate-scale-in rounded-3xl border border-amber-400/50 bg-gradient-to-b from-red-950/60 to-emerald-950/60 p-8 shadow-2xl">
              <p className="mb-2 text-6xl" aria-hidden="true">
                🎄
              </p>
              <h2 className="text-3xl font-black text-amber-300">
                {players[state.winnerId ?? ""]?.nickname ?? "聖誕幸運星"} 奪得聖誕大獎！
              </h2>
              <p className="mt-2 text-sm text-white/75">Merry Christmas &amp; Happy Party!</p>
            </div>
          </div>
        )}

        <HostGameControls />
      </div>
    </HostShell>
  );
}
