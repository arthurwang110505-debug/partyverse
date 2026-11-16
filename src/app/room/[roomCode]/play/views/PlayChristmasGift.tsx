"use client";

import { Gift } from "lucide-react";
import type { ChristmasGiftState } from "@/engine/christmasGift";
import { useRoom } from "@/providers/RoomContext";
import { useSubmitAction } from "@/hooks/useSubmitAction";
import { useGameViewState } from "@/hooks/useGameViewState";
import { PlayShell } from "@/components/game/PlayShell";
import { RoundTimer } from "@/components/game/RoundTimer";
import { vibrate, sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { screenNoun } from "@/lib/hostMode";

export default function PlayChristmasGift() {
  const { room, player } = useRoom();
  const submit = useSubmitAction();
  const state = useGameViewState<ChristmasGiftState>();

  if (!state || !player) return null;

  const myPick = state.picks?.[player.id];
  const pickTotal = Math.max(8, Math.min(30, room?.settings?.timer ?? 12));
  const myDelta = state.roundDeltas?.[player.id] ?? 0;

  return (
    <PlayShell round={`第 ${state.currentRound} / ${state.totalRounds} 回合`}>
      <div className="pt-2 text-center">
        <header className="mb-3">
          <span className="inline-flex items-center gap-1 text-xs font-bold tracking-wider text-emerald-300">
            <Gift className="h-3.5 w-3.5" aria-hidden="true" /> 🎄 聖誕驚喜禮物盒
          </span>
        </header>

        {state.twist && state.phase !== "result" && (
          <div className="mb-4 rounded-2xl border border-amber-400/35 bg-gradient-to-r from-red-950/50 to-emerald-950/50 p-3 text-left">
            <p className="text-xs font-black text-amber-200">
              {state.twist.icon} {state.twist.title}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-white/75">{state.twist.description}</p>
          </div>
        )}

        {state.phase === "picking" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-white/85">
                {myPick ? "✓ 已選好禮盒！等待大家同時拆封…" : "選一個想拆的禮盒："}
              </p>
              <RoundTimer compact haptic timeLeft={state.timeLeft} total={pickTotal} endLabel="開盒" className="w-24" />
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {state.boxes.map((box) => {
                const picked = myPick === box.id;
                return (
                  <button
                    key={box.id}
                    type="button"
                    disabled={Boolean(myPick)}
                    aria-pressed={picked}
                    onClick={() => {
                      if (myPick) return;
                      vibrate(20);
                      sfx.playPop();
                      void submit({ type: "pickBox", boxId: box.id }, { failMessage: "選擇失敗，請再試一次" });
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-all active:scale-95",
                      picked
                        ? "border-amber-300 bg-amber-500/20 ring-2 ring-amber-300"
                        : myPick
                          ? "border-white/5 bg-white/5 opacity-50"
                          : "border-white/15 bg-white/5 hover:bg-white/10",
                    )}
                    style={!picked && !myPick ? { borderColor: `${box.color}55` } : undefined}
                  >
                    <span className="text-3xl" aria-hidden="true">
                      {box.icon}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-black text-white">{box.title}</span>
                      <span className="block text-[11px] text-white/50">
                        {picked ? "你選擇了這個禮盒！" : "點擊秘密預訂"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {state.phase === "reveal" && (
          <div className="glass animate-scale-in space-y-3 rounded-3xl border border-amber-400/40 bg-emerald-950/30 p-6">
            <p className="text-5xl" aria-hidden="true">
              {myDelta > 0 ? "🎉" : myDelta < 0 ? "🧦" : "🎁"}
            </p>
            <h2 className="text-xl font-black text-white">
              {myPick
                ? myDelta > 0
                  ? `太神啦！本回合進帳 +${myDelta} 分！`
                  : myDelta < 0
                    ? `慘踩煤炭！本回合 ${myDelta} 分！`
                    : "本回合 +0 分"
                : "你這回合忘記選禮盒啦！"}
            </h2>
            <p className="text-xs text-white/65">看{screenNoun(room)}揭曉誰和你撞盒！</p>
          </div>
        )}

        {state.phase === "result" && (
          <div className="glass rounded-3xl border border-amber-400/40 bg-red-950/30 p-6">
            <p className="text-5xl" aria-hidden="true">
              🎄
            </p>
            <p className="mt-2 text-base font-black text-amber-200">聖誕派對結算中！</p>
            <p className="mt-1 text-xs text-white/65">看{screenNoun(room)}公佈最終排名！</p>
          </div>
        )}
      </div>
    </PlayShell>
  );
}
