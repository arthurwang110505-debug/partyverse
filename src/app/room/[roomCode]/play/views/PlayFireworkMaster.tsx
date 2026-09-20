"use client";

import { useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { FireworkDesign, FireworkGameState } from "@/engine/fireworkMaster";
import { Button } from "@/components/ui/Button";
import { PlayShell } from "@/components/game/PlayShell";

const PALETTE = ["#ef4444", "#f97316", "#eab308", "#10b981", "#06b6d4", "#a855f7", "#ec4899"];

export default function PlayFireworkMaster() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as FireworkGameState | undefined;
  const players = room?.players ?? {};

  const [color, setColor] = useState(PALETTE[0]);
  const [shape, setShape] = useState<FireworkDesign["shape"]>("circle");
  const [pending, setPending] = useState(false);

  if (!state || !player) return null;

  const myDesign = state.designs?.[player.id];
  const myVote = state.votes?.[player.id];

  const handleSubmit = async () => {
    setPending(true);
    try {
      await submitAction({
        type: "submitDesign",
        design: { color, shape, trailEffect: "sparkle", density: 40 },
      });
    } catch {
      toast("送出失敗，請再試一次");
    } finally {
      setPending(false);
    }
  };

  const handleVote = async (targetId: string) => {
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
              <div className="py-12">
                <p className="mb-2 text-5xl" aria-hidden="true">
                  ✨
                </p>
                <h3 className="text-lg font-bold text-white">煙火已完成調配！</h3>
                <p className="mt-1 text-sm text-white/50">請看大螢幕，煙火匯演即將開始！</p>
              </div>
            ) : (
              <>
                <div>
                  <span id="firework-color-label" className="mb-2 block text-xs font-bold text-white/60">
                    選擇煙火顏色
                  </span>
                  <div className="flex justify-center gap-2" role="group" aria-labelledby="firework-color-label">
                    {PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`顏色 ${c}`}
                        aria-pressed={color === c}
                        onClick={() => setColor(c)}
                        className={`h-9 w-9 rounded-full transition-transform ${
                          color === c ? "scale-125 ring-2 ring-white" : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <span id="firework-shape-label" className="mb-2 block text-xs font-bold text-white/60">
                    選擇綻放花紋
                  </span>
                  <div className="grid grid-cols-4 gap-2" role="group" aria-labelledby="firework-shape-label">
                    {(["circle", "star", "heart", "ring"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={shape === s}
                        onClick={() => setShape(s)}
                        className={`rounded-xl border px-1 py-2 text-xs font-bold transition-all ${
                          shape === s
                            ? "border-cyan-400 bg-cyan-400/20 text-cyan-300"
                            : "border-white/10 bg-white/5 text-white/60"
                        }`}
                      >
                        {s === "circle" && "圓球形"}
                        {s === "star" && "星芒型"}
                        {s === "heart" && "愛心型"}
                        {s === "ring" && "土星環"}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  variant="accent"
                  size="md"
                  className="mt-4 w-full"
                  loading={pending}
                  onClick={() => void handleSubmit()}
                >
                  發射並確認設計
                </Button>
              </>
            )}
          </div>
        )}

        {state.phase === "show" && (
          <div className="py-12">
            <p className="mb-3 animate-bounce text-5xl" aria-hidden="true">
              ✨
            </p>
            <p className="text-lg font-bold text-white">大螢幕煙火秀盛大放映中！</p>
          </div>
        )}

        {state.phase === "voting" && (
          <div className="py-2">
            <p className="mb-3 text-xs text-white/60">
              {myVote ? "已送出評審票！" : "投給你最驚艷的煙火設計："}
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
                    className={`rounded-2xl border p-3 text-center transition-all ${
                      myVote === id
                        ? "border-cyan-400 bg-cyan-400/20 text-cyan-300 ring-2 ring-cyan-400"
                        : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                    }`}
                  >
                    <span className="mb-1 block text-2xl" aria-hidden="true">
                      {p.avatar}
                    </span>
                    <span className="block truncate text-sm font-bold">{p.nickname}</span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </PlayShell>
  );
}
