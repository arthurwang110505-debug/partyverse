"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import {
  DRAW_COLORS,
  MAX_STROKES,
  MAX_STROKE_POINTS,
  drawHint,
  type DrawGameState,
  type StrokeLine,
} from "@/engine/drawAndGuess";
import { DrawingCanvas } from "@/components/game/DrawingCanvas";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PlayShell } from "@/components/game/PlayShell";
import { vibrate } from "@/lib/sound";
import { cn } from "@/lib/utils";

const COLORS = ["白色", "紅色", "藍色", "綠色", "黃色", "粉紅色", "紫色", "橘色"];
const BRUSHES = [
  { label: "細", width: 3 },
  { label: "中", width: 6 },
  { label: "粗", width: 12 },
];
const STREAM_MS = 100;
interface ActiveStroke {
  stroke: StrokeLine;
  version: number;
  submit: (action: unknown) => Promise<void>;
}

export default function PlayDrawAndGuess() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as DrawGameState | undefined;
  const [guessInput, setGuessInput] = useState("");
  const [pendingGuess, setPendingGuess] = useState(false);
  const [color, setColor] = useState(DRAW_COLORS[0]);
  const [width, setWidth] = useState(6);
  const [liveStroke, setLiveStroke] = useState<StrokeLine | null>(null);
  const [syncing, setSyncing] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const active = useRef<ActiveStroke | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failed = useRef(false);

  useEffect(() => {
    active.current = null;
    setLiveStroke(null);
    setGuessInput("");
    setPendingGuess(false);
    setConfirmClear(false);
    failed.current = false;
    if (timer.current) clearTimeout(timer.current);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      active.current = null;
    };
  }, [state?.phase, state?.currentRound, state?.drawerPlayerId, room?.startedAt]);

  useEffect(() => {
    if (
      !active.current &&
      liveStroke &&
      state?.strokes.some((s) => s.id === liveStroke.id && s.revision >= liveStroke.revision)
    )
      setLiveStroke(null);
  }, [state?.strokes, liveStroke]);

  if (!state || !player || !room) return null;
  const amDrawer = player.id === state.drawerPlayerId;
  const solved = state.correctPlayerIds.includes(player.id);
  const drawing = state.phase === "drawing";
  const canDraw = drawing && amDrawer && state.strokes.length < MAX_STROKES;
  const lastGuess = state.guesses[player.id];

  const flush = (current: ActiveStroke) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const stroke = { ...current.stroke, points: [...current.stroke.points] };
    setSyncing((count) => count + 1);
    // Captured at pointer-down so an old stroke cannot be submitted as a new round's action.
    void current
      .submit({ type: "addStroke", stroke, canvasVersion: current.version })
      .catch(() => {
        if (!failed.current) {
          toast("畫筆同步失敗，請檢查連線後再畫一次");
          failed.current = true;
        }
        setLiveStroke((line) => (line?.id === stroke.id ? null : line));
      })
      .finally(() => setSyncing((count) => Math.max(0, count - 1)));
  };
  const coords = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [
      Math.round(Math.max(0, Math.min(400, ((e.clientX - rect.left) / rect.width) * 400))),
      Math.round(Math.max(0, Math.min(400, ((e.clientY - rect.top) / rect.height) * 400))),
    ];
  };
  const pointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (!canDraw || active.current || !e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const stroke: StrokeLine = {
      id: `${player.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      revision: 1,
      color,
      width,
      points: coords(e),
    };
    active.current = { stroke, version: state.canvasVersion, submit: submitAction };
    setLiveStroke(stroke);
    flush(active.current);
  };
  const pointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const current = active.current;
    if (!current || !e.isPrimary) return;
    const [x, y] = coords(e);
    let points = current.stroke.points;
    if (Math.hypot(x - points[points.length - 2], y - points[points.length - 1]) < 2) return;
    if (points.length >= MAX_STROKE_POINTS) {
      points = points.filter((_, index) => Math.floor(index / 2) % 2 === 0);
    }
    current.stroke = { ...current.stroke, revision: current.stroke.revision + 1, points: [...points, x, y] };
    setLiveStroke(current.stroke);
    if (!timer.current)
      timer.current = setTimeout(() => {
        if (active.current === current) flush(current);
      }, STREAM_MS);
  };
  const pointerUp = (e: PointerEvent<SVGSVGElement>) => {
    if (!active.current || !e.isPrimary) return;
    const current = active.current;
    active.current = null;
    flush(current);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const tool = async (type: "undoStroke" | "clearCanvas") => {
    setSyncing((n) => n + 1);
    setLiveStroke(null);
    vibrate(12);
    try {
      await submitAction({ type });
      setConfirmClear(false);
    } catch {
      toast("畫布操作失敗，請再試一次");
    } finally {
      setSyncing((n) => Math.max(0, n - 1));
    }
  };
  const guess = async () => {
    if (!guessInput.trim() || pendingGuess || !drawing || solved) return;
    setPendingGuess(true);
    try {
      await submitAction({ type: "guessWord", word: guessInput.trim() });
      setGuessInput("");
      vibrate(12);
    } catch {
      toast("答案未送出，請再試一次");
    } finally {
      setPendingGuess(false);
    }
  };

  return (
    <PlayShell round={`${state.currentRound} / ${state.totalRounds}`}>
      <div className="space-y-4 pt-4">
        <RoundTimer
          compact
          timeLeft={state.timeLeft}
          total={drawing ? state.drawDuration : state.phase === "briefing" ? 3 : 5}
          endLabel={drawing ? "作畫結束" : "下一階段"}
        />
        {state.phase === "briefing" && (
          <section className="rounded-2xl border border-pink-400/30 bg-pink-500/10 p-6 text-center" role="status">
            <p className="mb-2 text-sm text-pink-200">
              {amDrawer ? "準備輪到你畫！" : `${room.players[state.drawerPlayerId]?.nickname ?? "畫家"} 準備作畫`}
            </p>
            {amDrawer && <h2 className="mb-3 text-3xl font-black">{state.prompt.word}</h2>}
            <p className="text-sm leading-relaxed text-white/70">
              {amDrawer
                ? "用圖畫表達，別寫出答案！每有人猜中，你得 5 分。"
                : "看大螢幕的畫作，在手機輸入答案。越早猜中，得分越高！"}
            </p>
          </section>
        )}
        {drawing && (
          <>
            <header className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
              {amDrawer ? (
                <>
                  <p className="text-xs text-pink-200">只有你看到的題目 · {state.prompt.category}</p>
                  <h2 className="mt-1 text-2xl font-black">{state.prompt.word}</h2>
                </>
              ) : (
                <>
                  <p className="text-sm text-white/70">
                    提示：{state.prompt.category} · {Array.from(state.prompt.word).length} 個字
                  </p>
                  <p className="mt-2 text-2xl tracking-widest text-pink-200">
                    {drawHint(state, room.settings.difficulty)}
                  </p>
                </>
              )}
            </header>
            {amDrawer ? (
              <>
                <div className="flex gap-1 overflow-x-auto pb-1" aria-label="畫筆顏色">
                  {DRAW_COLORS.map((c, index) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={COLORS[index]}
                      aria-pressed={color === c}
                      onClick={() => setColor(c)}
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
                        color === c ? "border-white bg-white/15" : "border-transparent",
                      )}
                    >
                      <span className="h-6 w-6 rounded-full border border-white/20" style={{ backgroundColor: c }} />
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-1">
                    {BRUSHES.map((b) => (
                      <button
                        key={b.width}
                        type="button"
                        aria-pressed={width === b.width}
                        onClick={() => setWidth(b.width)}
                        className={cn(
                          "h-11 min-w-11 rounded-xl px-3 text-sm",
                          width === b.width ? "bg-white/20 font-bold" : "bg-white/5 text-white/60",
                        )}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="復原上一筆"
                      disabled={!state.strokes.length || !!active.current || syncing > 0}
                      onClick={() => void tool("undoStroke")}
                    >
                      <RotateCcw className="h-5 w-5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="清除全畫布"
                      disabled={!state.strokes.length || !!active.current || syncing > 0}
                      onClick={() => setConfirmClear(true)}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                <DrawingCanvas
                  aria-label="繪畫畫布"
                  className="aspect-square w-full touch-none select-none rounded-2xl border-2 border-white/20 bg-slate-950"
                  strokes={state.strokes}
                  liveStroke={liveStroke}
                  onPointerDown={pointerDown}
                  onPointerMove={pointerMove}
                  onPointerUp={pointerUp}
                  onPointerCancel={pointerUp}
                />
                <p className="text-center text-xs text-white/60">
                  {state.strokes.length >= MAX_STROKES
                    ? "畫布已滿，請復原或清除後繼續。"
                    : syncing
                      ? "正在同步畫筆…"
                      : "邊畫邊同步到大螢幕 · 可在畫布外放開手指"}
                </p>
              </>
            ) : solved ? (
              <section
                className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center"
                role="status"
              >
                <h2 className="text-2xl font-black text-emerald-300">
                  答對了！+{state.roundScores[player.id] ?? 0} 分
                </h2>
                <p className="mt-3 text-sm text-white/70">先別說出答案，讓其他人也猜猜看。</p>
              </section>
            ) : (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void guess();
                }}
              >
                <label htmlFor="draw-guess" className="block text-sm text-white/70">
                  看看大螢幕，你猜這是什麼？
                </label>
                <input
                  id="draw-guess"
                  maxLength={40}
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  autoComplete="off"
                  className="w-full rounded-2xl border border-white/20 bg-white/5 p-4 text-center text-lg"
                  placeholder="輸入答案…"
                />
                <Button
                  variant="accent"
                  type="submit"
                  className="w-full"
                  disabled={!guessInput.trim() || pendingGuess}
                  loading={pendingGuess}
                >
                  送出答案
                </Button>
                <p className="min-h-5 text-center text-sm text-amber-200" role="status">
                  {lastGuess ? `「${lastGuess}」還不對，再試試！` : "猜中得 10–25 分，越快越高！"}
                </p>
              </form>
            )}
          </>
        )}
        {state.phase === "reveal" && (
          <section className="rounded-2xl border border-pink-400/30 bg-pink-500/10 p-6 text-center" role="status">
            <p className="text-sm text-pink-200">
              {state.roundReason === "disconnected" ? "玩家離線，本回合提早結束" : "答案揭曉"}
            </p>
            <h2 className="my-3 text-3xl font-black">{state.prompt.word}</h2>
            <p className="text-lg font-bold text-emerald-300">本回合 +{state.roundScores[player.id] ?? 0} 分</p>
            <p className="mt-3 text-sm text-white/60">
              {state.currentRound < state.totalRounds ? "下一位畫家準備中…" : "準備結算…"}
            </p>
          </section>
        )}
      </div>
      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title="清除整張畫布？">
        <p className="mb-4 text-sm text-white/70">這個動作無法復原。也可以只復原上一筆。</p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setConfirmClear(false)}>
            取消
          </Button>
          <Button variant="danger" onClick={() => void tool("clearCanvas")} loading={syncing > 0}>
            清除畫布
          </Button>
        </div>
      </Modal>
    </PlayShell>
  );
}
