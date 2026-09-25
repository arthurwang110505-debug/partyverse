"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { engineRoom } from "@/engine/participants";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import {
  FIREWORK_COLORS,
  MAX_FW_POINTS,
  MAX_FW_STROKES,
  sanitizeDesign,
  type FireworkGameState,
  type FireworkStroke,
} from "@/engine/fireworkMaster";
import { Button } from "@/components/ui/Button";
import { PlayShell } from "@/components/game/PlayShell";
import { RoundTimer } from "@/components/game/RoundTimer";
import { FireworkSketch } from "@/components/game/FireworkSketch";
import { vibrate, sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";

const BRUSHES = [
  { label: "細", width: 3 },
  { label: "中", width: 6 },
  { label: "粗", width: 11 },
];

const IDEAS = ["愛心 💖", "星星 ⭐", "笑臉 😊", "你的名字", "花朵 🌸", "貓咪 🐱", "閃電 ⚡", "彩虹 🌈"];

export default function PlayFireworkMaster() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as FireworkGameState | undefined;
  const players = room ? engineRoom(room).players : {};

  const [strokes, setStrokes] = useState<FireworkStroke[]>([]);
  const [live, setLive] = useState<FireworkStroke | null>(null);
  const [color, setColor] = useState(FIREWORK_COLORS[0]);
  const [width, setWidth] = useState(6);
  const [pending, setPending] = useState(false);
  const [cheerCount, setCheerCount] = useState(0);
  const drawing = useRef<FireworkStroke | null>(null);

  // A fresh canvas for every new match.
  useEffect(() => {
    setStrokes([]);
    setLive(null);
    drawing.current = null;
  }, [room?.startedAt]);

  if (!state || !player) return null;

  const myDesign = state.designs?.[player.id];
  const myVote = state.votes?.[player.id];
  const idea = IDEAS[(player.id.charCodeAt(0) + (room?.startedAt ?? 0)) % IDEAS.length];

  const coords = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [
      Math.round(Math.max(0, Math.min(400, ((e.clientX - rect.left) / rect.width) * 400))),
      Math.round(Math.max(0, Math.min(400, ((e.clientY - rect.top) / rect.height) * 400))),
    ];
  };
  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (!e.isPrimary || strokes.length >= MAX_FW_STROKES) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = { c: color, w: width, p: coords(e) };
    setLive(drawing.current);
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const cur = drawing.current;
    if (!cur || cur.p.length >= MAX_FW_POINTS) return;
    const [x, y] = coords(e);
    const lx = cur.p[cur.p.length - 2];
    const ly = cur.p[cur.p.length - 1];
    if (Math.hypot(x - lx, y - ly) < 4) return;
    drawing.current = { ...cur, p: [...cur.p, x, y] };
    setLive(drawing.current);
  };
  const up = () => {
    const cur = drawing.current;
    drawing.current = null;
    setLive(null);
    if (cur) setStrokes((list) => [...list, cur].slice(0, MAX_FW_STROKES));
  };

  const handleSubmit = async () => {
    if (strokes.length === 0) {
      toast("先畫點東西再發射吧！");
      return;
    }
    setPending(true);
    vibrate(25);
    try {
      await submitAction({ type: "submitDesign", design: { strokes } });
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

  const shown = live ? [...strokes, live] : strokes;

  return (
    <PlayShell>
      <div className="text-center">
        <header className="mb-3 mt-1">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-cyan-400">煙火大師 🎆</span>
        </header>

        {state.phase === "designing" && (
          <div className="space-y-3">
            {myDesign ? (
              <div className="rounded-3xl border border-cyan-500/30 bg-cyan-950/30 p-5">
                <FireworkSketch
                  strokes={sanitizeDesign(myDesign).strokes}
                  className="mx-auto mb-3 aspect-square w-40 rounded-2xl bg-black/70"
                />
                <h3 className="text-xl font-black text-white">煙火已填裝完成！</h3>
                <p className="mt-1 text-sm text-cyan-200/80">等大家畫完，就會在大螢幕一起施放！</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-white/70">
                  用手指畫出你的煙火！想不到？試試 <span className="font-bold text-cyan-300">{idea}</span>
                </p>
                <svg
                  viewBox="0 0 400 400"
                  className="mx-auto aspect-square w-full max-w-sm touch-none select-none rounded-3xl border-2 border-cyan-400/30 bg-[radial-gradient(circle_at_50%_40%,#141432,#05050d)]"
                  role="img"
                  aria-label="煙火畫布，用手指作畫"
                  onPointerDown={down}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={up}
                  onPointerLeave={up}
                >
                  <FireworkSketch strokes={shown} />
                </svg>

                <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="選擇顏色">
                  {FIREWORK_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`顏色 ${c}`}
                      aria-pressed={color === c}
                      onClick={() => {
                        setColor(c);
                        vibrate(8);
                      }}
                      className={cn(
                        "h-9 w-9 rounded-full transition-all",
                        color === c ? "scale-110 ring-4 ring-white" : "opacity-80",
                      )}
                      style={{ backgroundColor: c, boxShadow: `0 0 12px ${c}` }}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-center gap-2">
                  {BRUSHES.map((b) => (
                    <button
                      key={b.width}
                      type="button"
                      aria-pressed={width === b.width}
                      onClick={() => setWidth(b.width)}
                      className={cn(
                        "min-h-10 rounded-xl border px-3 text-sm font-bold",
                        width === b.width ? "border-cyan-400 bg-cyan-400/20 text-white" : "border-white/10 bg-white/5 text-white/60",
                      )}
                    >
                      {b.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="復原上一筆"
                    disabled={strokes.length === 0}
                    onClick={() => setStrokes((list) => list.slice(0, -1))}
                    className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-white/80 disabled:opacity-30"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="清除畫布"
                    disabled={strokes.length === 0}
                    onClick={() => setStrokes([])}
                    className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-white/80 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <RoundTimer timeLeft={state.timeLeft} total={Math.max(30, room?.settings?.timer ?? 60)} endLabel="時間到自動發射" compact />

                <Button
                  variant="accent"
                  size="lg"
                  className="w-full"
                  loading={pending}
                  disabled={strokes.length === 0}
                  onClick={() => void handleSubmit()}
                >
                  🚀 填裝並發射
                </Button>
              </>
            )}
          </div>
        )}

        {state.phase === "show" && (
          <div className="space-y-4 py-6">
            <p className="animate-bounce text-6xl" aria-hidden="true">
              🎆
            </p>
            <h3 className="text-xl font-black text-white">大螢幕煙火秀施放中！</h3>
            <p className="text-xs text-white/60">抬頭看看大家畫的煙火在夜空綻放！</p>
            <div className="pt-4">
              <button
                type="button"
                onClick={handleCheer}
                className="mx-auto flex h-36 w-36 flex-col items-center justify-center rounded-full border-4 border-cyan-400 bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-2xl transition-transform active:scale-90"
              >
                <span className="text-3xl">👏</span>
                <span className="mt-1 text-sm font-bold">為煙火喝采</span>
                {cheerCount > 0 && <span className="mt-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px]">+{cheerCount}</span>}
              </button>
            </div>
          </div>
        )}

        {state.phase === "voting" && (
          <div className="py-2">
            <p className="mb-3 text-xs font-semibold text-white/80">
              {myVote ? "✓ 已送出評審票，等待計票中！" : "選出你心中最驚豔的煙火："}
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
                      "rounded-2xl border p-2 text-center shadow-md transition-all active:scale-95",
                      myVote === id
                        ? "border-cyan-400 bg-cyan-500/25 text-cyan-200 ring-2 ring-cyan-400"
                        : "border-white/10 bg-white/5 text-white",
                    )}
                  >
                    <FireworkSketch
                      strokes={sanitizeDesign(state.designs?.[id]).strokes}
                      label={`${p.nickname} 的煙火`}
                      className="mb-1 aspect-square w-full rounded-xl bg-black/70"
                    />
                    <span className="block truncate text-sm font-bold">
                      {p.avatar} {p.nickname}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </PlayShell>
  );
}
