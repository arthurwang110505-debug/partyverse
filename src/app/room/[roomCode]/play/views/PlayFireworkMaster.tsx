"use client";

import { useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import type { FireworkDesign, FireworkGameState } from "@/engine/fireworkMaster";
import { Button } from "@/components/ui/Button";

const PALETTE = ["#ef4444", "#f97316", "#eab308", "#10b981", "#06b6d4", "#a855f7", "#ec4899"];

export default function PlayFireworkMaster() {
  const { room, player, submitAction } = useRoom();
  const state = room?.gameState as FireworkGameState | undefined;
  const players = room?.players ?? {};

  const [color, setColor] = useState(PALETTE[0]);
  const [shape, setShape] = useState<FireworkDesign["shape"]>("circle");

  if (!state || !player) return null;

  const myDesign = state.designs?.[player.id];
  const myVote = state.votes?.[player.id];

  const handleSubmit = async () => {
    try {
      await submitAction({
        type: "submitDesign",
        design: { color, shape, trailEffect: "sparkle", density: 40 },
      });
    } catch {
      // Ignore
    }
  };

  const handleVote = async (targetId: string) => {
    try {
      await submitAction({ type: "voteDesign", targetPlayerId: targetId });
    } catch {
      // Ignore
    }
  };

  return (
    <div className="mx-auto max-w-md text-center p-4">
      <header className="mb-4">
        <span className="text-xs uppercase tracking-wider text-cyan-400 font-bold block mb-1">
          煙火大師 🎆
        </span>
      </header>

      {state.phase === "designing" && (
        <div className="py-2 space-y-5">
          {myDesign ? (
            <div className="py-12">
              <p className="text-5xl mb-2">✨</p>
              <h3 className="font-bold text-white text-lg">煙火已完成調配！</h3>
              <p className="text-sm text-white/50 mt-1">請看大螢幕，煙火匯演即將開始！</p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs text-white/60 block mb-2 font-bold">選擇煙火顏色</label>
                <div className="flex justify-center gap-2">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-9 h-9 rounded-full transition-transform ${
                        color === c ? "scale-125 ring-2 ring-white" : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-white/60 block mb-2 font-bold">選擇綻放花紋</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["circle", "star", "heart", "ring"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setShape(s)}
                      className={`py-2 px-1 rounded-xl border text-xs font-bold transition-all ${
                        shape === s ? "border-cyan-400 bg-cyan-400/20 text-cyan-300" : "border-white/10 bg-white/5 text-white/60"
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

              <Button variant="primary" size="md" className="w-full mt-4" onClick={() => void handleSubmit()}>
                發射並確認設計
              </Button>
            </>
          )}
        </div>
      )}

      {state.phase === "show" && (
        <div className="py-12">
          <p className="text-5xl mb-3 animate-bounce">✨</p>
          <p className="text-lg font-bold text-white">大螢幕煙火秀盛大放映中！</p>
        </div>
      )}

      {state.phase === "voting" && (
        <div className="py-2">
          <p className="text-xs text-white/60 mb-3">
            {myVote ? "已送出評審票！" : "投給你最驚艷的煙火設計："}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(players)
              .filter(([id]) => id !== player.id)
              .map(([id, p]) => (
                <button
                  key={id}
                  disabled={Boolean(myVote)}
                  onClick={() => void handleVote(id)}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    myVote === id
                      ? "border-cyan-400 bg-cyan-400/20 text-cyan-300 ring-2 ring-cyan-400"
                      : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  <span className="text-2xl block mb-1">{p.avatar}</span>
                  <span className="text-sm font-bold truncate block">{p.nickname}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
