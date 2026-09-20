"use client";

import { useRef, useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { DrawGameState, StrokeLine } from "@/engine/drawAndGuess";
import { Button } from "@/components/ui/Button";
import { PlayShell } from "@/components/game/PlayShell";

export default function PlayDrawAndGuess() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as DrawGameState | undefined;
  const [guessInput, setGuessInput] = useState("");
  const isDrawing = useRef(false);
  const currentPoints = useRef<number[]>([]);

  if (!state || !player) return null;

  const amIDrawer = player.id === state.drawerPlayerId;
  const hasGuessed = state.correctPlayerIds?.includes(player.id);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!amIDrawer) return;
    isDrawing.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 400;
    const y = ((e.clientY - rect.top) / rect.height) * 400;
    currentPoints.current = [Math.round(x), Math.round(y)];
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!amIDrawer || !isDrawing.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 400;
    const y = ((e.clientY - rect.top) / rect.height) * 400;
    currentPoints.current.push(Math.round(x), Math.round(y));
  };

  const handlePointerUp = async () => {
    if (!amIDrawer || !isDrawing.current) return;
    isDrawing.current = false;
    if (currentPoints.current.length >= 4) {
      const stroke: StrokeLine = {
        color: "#ffffff",
        width: 4,
        points: currentPoints.current,
      };
      try {
        await submitAction({ type: "addStroke", stroke });
      } catch {
        toast("線條沒送出去，再畫一次");
      }
    }
    currentPoints.current = [];
  };

  const handleClear = async () => {
    try {
      await submitAction({ type: "clearCanvas" });
    } catch {
      toast("清除失敗，請再試一次");
    }
  };

  const handleGuess = async () => {
    if (!guessInput.trim()) return;
    try {
      await submitAction({ type: "guessWord", word: guessInput.trim() });
      setGuessInput("");
    } catch {
      toast("送答失敗，請再試一次");
    }
  };

  return (
    <PlayShell round={`第 ${state.currentRound} 回合`}>
      <div className="text-center">
        <header className="mb-3 mt-2">
          <span className="mb-0.5 block text-xs font-bold uppercase tracking-wider text-pink-400">你畫我猜 🎨</span>
          {amIDrawer ? (
            <div className="glass rounded-2xl border border-pink-400/40 bg-pink-400/10 p-3">
              <span className="block text-xs text-pink-300">你的繪畫題目（請畫出來）</span>
              <span className="text-2xl font-black text-white">{state.prompt?.word}</span>
            </div>
          ) : (
            <p className="text-sm text-white/70">題目類別：{state.prompt?.category}</p>
          )}
        </header>

        {amIDrawer ? (
          <div className="space-y-3">
            <div className="mx-auto aspect-square w-full touch-none overflow-hidden rounded-2xl border border-white/20 bg-slate-900 shadow-inner">
              <svg
                className="h-full w-full cursor-crosshair"
                viewBox="0 0 400 400"
                role="img"
                aria-label="繪畫畫布"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={() => void handlePointerUp()}
                onPointerLeave={() => void handlePointerUp()}
              >
                {state.strokes.map((s, idx) => {
                  const pts = s.points;
                  if (pts.length < 2) return null;
                  let d = `M ${pts[0]} ${pts[1]}`;
                  for (let i = 2; i < pts.length; i += 2) d += ` L ${pts[i]} ${pts[i + 1]}`;
                  return (
                    <path key={idx} d={d} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" />
                  );
                })}
              </svg>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void handleClear()}>
              清除畫布
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-6">
            {hasGuessed ? (
              <div className="py-8">
                <p className="mb-2 text-5xl" aria-hidden="true">
                  🎉
                </p>
                <h3 className="text-xl font-bold text-emerald-400">你答對了！</h3>
                <p className="mt-1 text-sm text-white/50">成功獲得 +15 積分！</p>
              </div>
            ) : (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleGuess();
                }}
              >
                <p className="text-xs text-white/60">看大螢幕線條，輸入你的猜測：</p>
                <label htmlFor="guess-input" className="sr-only">
                  你的猜測
                </label>
                <input
                  id="guess-input"
                  type="text"
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  placeholder="輸入答案（例：西瓜）"
                  className="w-full rounded-xl border border-white/20 bg-white/5 p-4 text-center text-lg text-white transition-colors focus:border-pink-500 focus:outline-none"
                />
                <Button variant="accent" size="md" className="w-full" disabled={!guessInput.trim()} type="submit">
                  送出猜題
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </PlayShell>
  );
}
