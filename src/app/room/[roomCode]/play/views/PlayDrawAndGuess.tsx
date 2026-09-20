"use client";

import { useRef, useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { DrawGameState, StrokeLine } from "@/engine/drawAndGuess";
import { Button } from "@/components/ui/Button";
import { PlayShell } from "@/components/game/PlayShell";
import { RotateCcw, Trash2, Palette } from "lucide-react";
import { vibrate } from "@/lib/sound";
import { cn } from "@/lib/utils";

const PALETTE = ["#ffffff", "#ef4444", "#3b82f6", "#10b981", "#eab308", "#ec4899", "#8b5cf6", "#f97316"];
const BRUSH_SIZES = [
  { label: "細", width: 3 },
  { label: "中", width: 6 },
  { label: "粗", width: 12 },
];

export default function PlayDrawAndGuess() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as DrawGameState | undefined;
  const [guessInput, setGuessInput] = useState("");
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);
  const [selectedWidth, setSelectedWidth] = useState(6);
  const [livePoints, setLivePoints] = useState<number[]>([]);

  const isDrawing = useRef(false);
  const currentPoints = useRef<number[]>([]);

  if (!state || !player) return null;

  const amIDrawer = player.id === state.drawerPlayerId;
  const hasGuessed = state.correctPlayerIds?.includes(player.id);
  const lastGuess = state.guesses?.[player.id];

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!amIDrawer) return;
    isDrawing.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 400;
    const y = ((e.clientY - rect.top) / rect.height) * 400;
    currentPoints.current = [Math.round(x), Math.round(y)];
    setLivePoints([Math.round(x), Math.round(y)]);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!amIDrawer || !isDrawing.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 400;
    const y = ((e.clientY - rect.top) / rect.height) * 400;
    currentPoints.current.push(Math.round(x), Math.round(y));
    setLivePoints([...currentPoints.current]);
  };

  const handlePointerUp = async () => {
    if (!amIDrawer || !isDrawing.current) return;
    isDrawing.current = false;
    setLivePoints([]);
    if (currentPoints.current.length >= 4) {
      const stroke: StrokeLine = {
        color: selectedColor,
        width: selectedWidth,
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

  const handleUndo = async () => {
    vibrate(12);
    try {
      await submitAction({ type: "undoStroke" });
    } catch {
      toast("復原失敗");
    }
  };

  const handleClear = async () => {
    vibrate(20);
    try {
      await submitAction({ type: "clearCanvas" });
    } catch {
      toast("清除失敗，請再試一次");
    }
  };

  const handleGuess = async () => {
    const clean = guessInput.trim();
    if (!clean) return;
    vibrate(15);
    try {
      await submitAction({ type: "guessWord", word: clean });
      setGuessInput("");
    } catch {
      toast("送答失敗，請再試一次");
    }
  };

  const renderPath = (pts: number[]) => {
    if (pts.length < 2) return "";
    let d = `M ${pts[0]} ${pts[1]}`;
    for (let i = 2; i < pts.length; i += 2) d += ` L ${pts[i]} ${pts[i + 1]}`;
    return d;
  };

  return (
    <PlayShell round={`第 ${state.currentRound} 回合`}>
      <div className="text-center pt-2">
        <header className="mb-3">
          <span className="mb-1 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-pink-400">
            <Palette className="h-3.5 w-3.5" /> 你畫我猜
          </span>
          {amIDrawer ? (
            <div className="glass rounded-2xl border border-pink-400/40 bg-pink-500/10 p-3 shadow-lg">
              <span className="block text-xs font-semibold text-pink-300">輪到你畫！請畫出以下題目：</span>
              <span className="text-3xl font-black text-white tracking-wider">{state.prompt?.word}</span>
              <span className="block text-[11px] text-white/50 mt-0.5">分類：{state.prompt?.category}</span>
            </div>
          ) : (
            <div className="glass rounded-2xl border border-white/10 p-2.5">
              <p className="text-xs text-white/60">
                畫家正在作畫 · 提示分類：
                <span className="font-bold text-pink-300 ml-1">{state.prompt?.category}</span>
              </p>
            </div>
          )}
        </header>

        {amIDrawer ? (
          <div className="space-y-3">
            {/* Drawing Tools Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              {/* Color Palette */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className={cn(
                      "h-6 w-6 rounded-full border border-white/30 transition-transform active:scale-90",
                      selectedColor === c && "ring-2 ring-white scale-110",
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`顏色 ${c}`}
                  />
                ))}
              </div>

              {/* Brush Width & Actions */}
              <div className="flex items-center gap-1">
                {BRUSH_SIZES.map((b) => (
                  <button
                    key={b.width}
                    type="button"
                    onClick={() => setSelectedWidth(b.width)}
                    className={cn(
                      "rounded-lg px-2 py-1 text-xs font-medium transition-all",
                      selectedWidth === b.width
                        ? "bg-white/20 text-white font-bold"
                        : "text-white/40 hover:text-white/70",
                    )}
                  >
                    {b.label}
                  </button>
                ))}
                <span className="h-4 w-px bg-white/20 mx-1" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => void handleUndo()}
                  disabled={state.strokes.length === 0}
                  className="rounded-lg p-1.5 text-white/60 hover:text-white disabled:opacity-30 transition-all active:scale-90"
                  aria-label="復原上一筆"
                  title="復原"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleClear()}
                  disabled={state.strokes.length === 0}
                  className="rounded-lg p-1.5 text-white/60 hover:text-red-400 disabled:opacity-30 transition-all active:scale-90"
                  aria-label="清除全畫布"
                  title="清空"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Canvas */}
            <div className="mx-auto aspect-square w-full touch-none overflow-hidden rounded-2xl border-2 border-white/20 bg-slate-950 shadow-inner">
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
                  const d = renderPath(s.points);
                  if (!d) return null;
                  return (
                    <path
                      key={idx}
                      d={d}
                      stroke={s.color}
                      strokeWidth={s.width}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })}

                {/* Real-time active drawing stroke */}
                {livePoints.length >= 2 && (
                  <path
                    d={renderPath(livePoints)}
                    stroke={selectedColor}
                    strokeWidth={selectedWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
            </div>
            <p className="text-[11px] text-white/40">手指在方框內拖曳即可作畫，線條即時同步到大螢幕！</p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {hasGuessed ? (
              <div className="py-8 glass rounded-3xl border border-emerald-500/40 bg-emerald-500/10 p-6">
                <p className="mb-2 text-5xl animate-bounce" aria-hidden="true">
                  🎉
                </p>
                <h3 className="text-2xl font-black text-emerald-400">你答對了！</h3>
                <p className="mt-1 text-sm text-white/70">
                  成功獲得 <span className="font-bold text-yellow-300">+15 積分</span>！
                </p>
                <p className="mt-3 text-xs text-white/40">等待其他玩家猜題或本回合結束…</p>
              </div>
            ) : (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleGuess();
                }}
              >
                <p className="text-xs text-white/60">觀看電視大螢幕上的畫作，猜出它是什麼：</p>
                <label htmlFor="guess-input" className="sr-only">
                  你的猜測
                </label>
                <input
                  id="guess-input"
                  type="text"
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  placeholder="輸入你的答案（例如：西瓜）"
                  autoComplete="off"
                  className="w-full rounded-2xl border border-white/20 bg-white/5 p-4 text-center text-lg text-white font-medium transition-colors focus:border-pink-500 focus:outline-none shadow-inner"
                />
                <Button variant="accent" size="md" className="w-full font-bold shadow-lg" disabled={!guessInput.trim()} type="submit">
                  送出答案 🚀
                </Button>

                {lastGuess && !hasGuessed && (
                  <p className="text-xs text-amber-300/80 animate-shake">
                    上一猜「{lastGuess}」不對喔，再想想看！
                  </p>
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </PlayShell>
  );
}
