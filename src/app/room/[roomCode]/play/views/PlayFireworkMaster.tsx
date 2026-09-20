"use client";

import { engineRoom } from "@/engine/participants";

import { useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { FireworkDesign, FireworkGameState } from "@/engine/fireworkMaster";
import { Button } from "@/components/ui/Button";
import { PlayShell } from "@/components/game/PlayShell";
import { vibrate, sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";

const PALETTE = ["#ef4444", "#f97316", "#eab308", "#10b981", "#06b6d4", "#a855f7", "#ec4899"];

const SHAPES: Array<{ id: FireworkDesign["shape"]; label: string; icon: string }> = [
  { id: "circle", label: "圓球形", icon: "🟣" },
  { id: "star", label: "星芒型", icon: "⭐" },
  { id: "heart", label: "愛心型", icon: "💖" },
  { id: "ring", label: "土星環", icon: "🪐" },
];

export default function PlayFireworkMaster() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as FireworkGameState | undefined;
  const players = room ? engineRoom(room).players : {};

  const [color, setColor] = useState(PALETTE[0]);
  const [shape, setShape] = useState<FireworkDesign["shape"]>("circle");
  const [pending, setPending] = useState(false);
  const [cheerCount, setCheerCount] = useState(0);

  if (!state || !player) return null;

  const myDesign = state.designs?.[player.id];
  const myVote = state.votes?.[player.id];

  const handleSubmit = async () => {
    setPending(true);
    vibrate(25);
    try {
      await submitAction({
        type: "submitDesign",
        design: { color, shape, trailEffect: "sparkle", density: 40 },
      });
      sfx.playReady();
    } catch {
      toast("送出失敗，請再試一次");
    } finally {
      setPending(false);
    }
  };

  const handleCheer = () => {
    setCheerCount((c) => c + 1);
    vibrate(15);
    sfx.playPop();
  };

  const handleVote = async (targetId: string) => {
    vibrate(20);
    try {
      await submitAction({ type: "voteDesign", targetPlayerId: targetId });
    } catch {
      toast("投票失敗，請再試一次");
    }
  };

  return (
    <PlayShell>
      <div className="text-center">
        <header className="mb-4 mt-2">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-cyan-400">煙火大師 🎆</span>
        </header>

        {state.phase === "designing" && (
          <div className="space-y-5 py-2">
            {myDesign ? (
              <div className="py-12 rounded-3xl border border-cyan-500/30 bg-cyan-950/30 p-6">
                <p className="mb-2 text-5xl animate-bounce" aria-hidden="true">
                  ✨
                </p>
                <h3 className="text-xl font-black text-white">專屬煙火已完成調配！</h3>
                <p className="mt-1 text-sm text-cyan-200/80">請看大螢幕，盛大聯合匯演即將開始！</p>
              </div>
            ) : (
              <>
                {/* Visual Preview */}
                <div
                  className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl border-2 border-white/20 shadow-2xl transition-all duration-300"
                  style={{
                    backgroundColor: `${color}25`,
                    boxShadow: `0 0 30px ${color}60`,
                    borderColor: color,
                  }}
                >
                  <span className="text-4xl">{SHAPES.find((s) => s.id === shape)?.icon ?? "✨"}</span>
                </div>

                <div>
                  <span id="firework-color-label" className="mb-2 block text-xs font-bold text-white/60">
                    選擇煙火主色調
                  </span>
                  <div className="flex justify-center gap-2" role="group" aria-labelledby="firework-color-label">
                    {PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`顏色 ${c}`}
                        aria-pressed={color === c}
                        onClick={() => {
                          setColor(c);
                          vibrate(8);
                        }}
                        className={`h-9 w-9 rounded-full transition-all duration-150 cursor-pointer ${
                          color === c ? "scale-125 ring-4 ring-white shadow-lg" : "hover:scale-105 opacity-80"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <span id="firework-shape-label" className="mb-2 block text-xs font-bold text-white/60">
                    選擇綻放圖騰
                  </span>
                  <div className="grid grid-cols-4 gap-2" role="group" aria-labelledby="firework-shape-label">
                    {SHAPES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={shape === s.id}
                        onClick={() => {
                          setShape(s.id);
                          vibrate(8);
                        }}
                        className={cn(
                          "rounded-2xl border p-2 text-center transition-all cursor-pointer",
                          shape === s.id
                            ? "border-cyan-400 bg-cyan-400/25 text-white ring-2 ring-cyan-400"
                            : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
                        )}
                      >
                        <span className="block text-xl mb-0.5">{s.icon}</span>
                        <span className="block text-[11px] font-bold">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  variant="accent"
                  size="lg"
                  className="mt-4 w-full"
                  loading={pending}
                  onClick={() => void handleSubmit()}
                >
                  確認調配並填裝發射
                </Button>
              </>
            )}
          </div>
        )}

        {state.phase === "show" && (
          <div className="py-6 space-y-4">
            <p className="animate-bounce text-6xl" aria-hidden="true">
              🎆
            </p>
            <h3 className="text-xl font-black text-white">大螢幕煙火秀盛大放映中！</h3>
            <p className="text-xs text-white/60">抬頭欣賞大家調配的璀璨煙火夜空！</p>

            <div className="pt-4">
              <button
                type="button"
                onClick={handleCheer}
                className="mx-auto flex h-36 w-36 flex-col items-center justify-center rounded-full border-4 border-cyan-400 bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-2xl active:scale-90 transition-transform cursor-pointer"
              >
                <span className="text-3xl">👏</span>
                <span className="text-sm font-bold mt-1">為煙火喝采</span>
                {cheerCount > 0 && (
                  <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded-full mt-1">+{cheerCount}</span>
                )}
              </button>
            </div>
          </div>
        )}

        {state.phase === "voting" && (
          <div className="py-2">
            <p className="mb-3 text-xs font-semibold text-white/80">
              {myVote ? "✓ 已送出評審票，等待計票中！" : "選出你心中最驚豔的煙火設計："}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(players)
                .filter(([id]) => id !== player.id)
                .map(([id, p]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={myVote === id}
                    disabled={Boolean(myVote)}
                    onClick={() => void handleVote(id)}
                    className={cn(
                      "rounded-2xl border p-3.5 text-center transition-all active:scale-95 shadow-md",
                      myVote === id
                        ? "border-cyan-400 bg-cyan-500/25 text-cyan-200 ring-2 ring-cyan-400"
                        : "border-white/10 bg-white/5 text-white hover:bg-white/10",
                    )}
                  >
                    <span className="mb-1 block text-3xl" aria-hidden="true">
                      {p.avatar}
                    </span>
                    <span className="block truncate text-sm font-bold">{p.nickname}</span>
                    {myVote === id && (
                      <span className="mt-1 inline-block text-[10px] font-semibold text-cyan-300">已投此票</span>
                    )}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </PlayShell>
  );
}
