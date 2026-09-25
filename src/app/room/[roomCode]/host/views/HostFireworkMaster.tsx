"use client";

import { engineRoom } from "@/engine/participants";

import { useEffect, useRef, useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { sanitizeDesign, type FireworkDesign, type FireworkGameState } from "@/engine/fireworkMaster";
import { FireworkSketch } from "@/components/game/FireworkSketch";
import { HostGameControls } from "@/components/game/HostGameControls";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Confetti } from "@/components/game/Confetti";
import { sfx } from "@/lib/sound";

interface Spark {
  /** Target position (the drawing) and current position. */
  tx: number;
  ty: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  twinkle: number;
}

interface Shell {
  sparks: Spark[];
  cx: number;
  cy: number;
  rocketY: number;
  startY: number;
  color: string;
  born: number;
}

/** Sample the player's strokes into spark targets around (cx, cy). */
function sparksFor(design: FireworkDesign, cx: number, cy: number, size: number): Spark[] {
  const sparks: Spark[] = [];
  const scale = size / 400;
  for (const stroke of design.strokes) {
    const pts = stroke.p;
    for (let i = 0; i + 1 < pts.length; i += 2) {
      const x0 = pts[i];
      const y0 = pts[i + 1];
      const x1 = i + 3 < pts.length ? pts[i + 2] : x0;
      const y1 = i + 3 < pts.length ? pts[i + 3] : y0;
      const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 9));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        sparks.push({
          tx: cx + (x0 + (x1 - x0) * t - 200) * scale,
          ty: cy + (y0 + (y1 - y0) * t - 200) * scale,
          x: cx,
          y: cy,
          vx: 0,
          vy: 0,
          color: stroke.c,
          size: 1.2 + stroke.w * 0.22,
          twinkle: Math.random() * Math.PI * 2,
        });
      }
    }
  }
  // Keep the canvas fast even for very busy drawings.
  if (sparks.length > 700) {
    const keep = 700 / sparks.length;
    return sparks.filter(() => Math.random() < keep);
  }
  return sparks;
}

const RISE_MS = 700;
const BURST_MS = 450;
const HOLD_MS = 1300;
const FALL_MS = 1600;

export default function HostFireworkMaster() {
  const { room } = useRoom();
  const state = room?.gameState as FireworkGameState | undefined;
  const players = room ? engineRoom(room).players : {};

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [nowFiring, setNowFiring] = useState<{ name: string; icon: string } | null>(null);

  const phase = state?.phase;

  // Sound triggers on phase transition
  useEffect(() => {
    if (phase === "result") {
      sfx.playFanfare();
    }
  }, [phase]);

  // Grand show: each player's drawing is launched as a rocket and bursts
  // into sparks that trace exactly what they drew, then drift and fall.
  useEffect(() => {
    if (state?.phase !== "show" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const width = (canvas.width = canvas.parentElement?.clientWidth ?? 800);
    const height = (canvas.height = canvas.parentElement?.clientHeight ?? 420);
    const shells: Shell[] = [];
    const designs = Object.entries(state.designs ?? {}).map(([id, d]) => ({
      id,
      d: sanitizeDesign(d),
      name: players[id]?.nickname ?? "玩家",
      icon: players[id]?.avatar ?? "🎆",
    }));

    let index = -1;
    const launch = () => {
      index += 1;
      if (!designs.length) return;
      const design = designs[index % designs.length];
      const size = Math.min(width, height) * 0.62;
      const cx = width * (0.25 + Math.random() * 0.5);
      const cy = height * (0.38 + Math.random() * 0.12);
      shells.push({
        sparks: sparksFor(design.d, cx, cy, size),
        cx,
        cy,
        rocketY: height,
        startY: height,
        color: design.d.strokes[0]?.c ?? "#ffffff",
        born: performance.now(),
      });
      setNowFiring({ name: design.name, icon: design.icon });
      sfx.playTick(500 + (index % 4) * 120, 0.08);
      setTimeout(() => sfx.playBoom(), RISE_MS);
    };

    launch();
    const intervalMs = Math.max(2200, Math.floor(((state.timeLeft || 12) * 1000 - 1500) / Math.max(1, designs.length)));
    const spawnTimer = setInterval(launch, intervalMs);

    const render = () => {
      const now = performance.now();
      ctx.fillStyle = "rgba(5, 5, 16, 0.28)";
      ctx.fillRect(0, 0, width, height);

      for (let i = shells.length - 1; i >= 0; i--) {
        const sh = shells[i];
        const age = now - sh.born;
        if (age > RISE_MS + BURST_MS + HOLD_MS + FALL_MS) {
          shells.splice(i, 1);
          continue;
        }
        if (age < RISE_MS) {
          // Rocket trail rising to the burst point.
          const t = age / RISE_MS;
          const y = sh.startY + (sh.cy - sh.startY) * (1 - Math.pow(1 - t, 2));
          ctx.save();
          ctx.fillStyle = sh.color;
          ctx.shadowColor = sh.color;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(sh.cx + Math.sin(age / 40) * 2, y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          continue;
        }
        const t = age - RISE_MS;
        const fall = Math.max(0, t - BURST_MS - HOLD_MS);
        const alpha = fall > 0 ? Math.max(0, 1 - fall / FALL_MS) : 1;
        for (const sp of sh.sparks) {
          if (t < BURST_MS) {
            const e = 1 - Math.pow(1 - t / BURST_MS, 3);
            sp.x = sh.cx + (sp.tx - sh.cx) * e;
            sp.y = sh.cy + (sp.ty - sh.cy) * e;
          } else if (fall > 0) {
            if (sp.vx === 0 && sp.vy === 0) {
              sp.vx = (sp.tx - sh.cx) * 0.004 + (Math.random() - 0.5) * 0.4;
              sp.vy = (sp.ty - sh.cy) * 0.004;
            }
            sp.vy += 0.035;
            sp.x += sp.vx;
            sp.y += sp.vy;
          }
          sp.twinkle += 0.3;
          const a = alpha * (0.6 + 0.4 * Math.abs(Math.sin(sp.twinkle)));
          if (a <= 0.02) continue;
          ctx.globalAlpha = a;
          ctx.fillStyle = sp.color;
          ctx.shadowColor = sp.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(spawnTimer);
      setNowFiring(null);
    };
    // The show only starts once designs are frozen; restart only on phase change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase]);

  if (!state) return null;

  const livingPlayerCount = Object.keys(players).length;
  const voteCount = Object.keys(state.votes).length;

  return (
    <HostShell>
      {state.phase === "result" && <Confetti />}

      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <p className="mb-2 text-sm font-semibold tracking-wider text-cyan-400">煙火大師 🎆 · 創意競賽</p>
          <h1 className="px-4 text-3xl font-black text-white md:text-5xl">
            {state.phase === "designing" && "玩家正在手機上畫自己的煙火…"}
            {state.phase === "show" && "✨ 全體煙火聯合大匯演 ✨"}
            {state.phase === "voting" && "🗳️ 投票評選你最喜愛的煙火！"}
            {state.phase === "result" && "🏆 最佳煙火設計大師！"}
          </h1>
        </header>

        {state.phase === "designing" && (
          <div className="my-10">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer
                timeLeft={state.timeLeft}
                total={Math.max(30, room?.settings?.timer ?? 60)}
                endLabel="設計截止"
              />
            </div>
            <p className="text-white/60">用手指在手機畫出任何圖案：愛心、名字、笑臉……畫什麼就炸出什麼！</p>
          </div>
        )}

        {state.phase === "show" && (
          <div className="relative my-8 h-[26rem] overflow-hidden rounded-3xl border border-cyan-500/30 bg-black/80 shadow-2xl">
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-around px-4">
              {Object.entries(state.designs).map(([id, d]) => (
                <div key={id} className="text-center">
                  <FireworkSketch strokes={sanitizeDesign(d).strokes} className="mx-auto h-10 w-10 rounded-lg bg-black/60" />
                  <p className="mt-1 text-xs font-bold text-white drop-shadow-md">{players[id]?.nickname}</p>
                </div>
              ))}
            </div>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
              <span className="rounded-full bg-black/60 px-4 py-1.5 text-xs font-bold text-yellow-300 border border-yellow-400/40 animate-pulse">
                🎆 盛大綻放中 · 剩餘 {state.timeLeft} 秒
              </span>
            </div>
            {nowFiring && (
              <div className="absolute top-14 left-1/2 -translate-x-1/2 pointer-events-none" key={nowFiring.name}>
                <span className="block rounded-full bg-black/70 px-5 py-2 text-lg font-black text-white border border-cyan-400/50 shadow-lg shadow-cyan-500/30 animate-scale-in">
                  {nowFiring.icon} {nowFiring.name} 的煙火！
                </span>
              </div>
            )}
          </div>
        )}

        {state.phase === "voting" && (
          <div className="my-8">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer timeLeft={state.timeLeft} total={15} endLabel="投票截止" />
            </div>
            <p className="text-lg text-white mb-4">請在手機投下你最欣賞的設計！</p>
            <div className="mx-auto max-w-md">
              <div className="mb-2 flex items-center justify-between text-sm font-semibold text-cyan-300">
                <span>投票進度</span>
                <span>
                  {voteCount} / {livingPlayerCount} 票
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (voteCount / Math.max(1, livingPlayerCount)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {state.phase === "result" && (
          <div className="my-8 inline-block animate-scale-in rounded-3xl border border-cyan-400/40 bg-cyan-950/40 p-8 shadow-2xl">
            <p className="mb-2 text-6xl animate-bounce" aria-hidden="true">
              🎆
            </p>
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-cyan-300">人氣總冠軍</span>
            <h2 className="mb-2 text-3xl font-black text-white">
              {state.winnerId ? players[state.winnerId]?.nickname : "全體大師"} 贏得最佳煙火賞！
            </h2>
            {state.winnerId && state.designs?.[state.winnerId] && (
              <FireworkSketch
                strokes={sanitizeDesign(state.designs[state.winnerId]).strokes}
                className="mx-auto mb-3 aspect-square w-56 rounded-2xl bg-black/70"
              />
            )}
            <p className="text-sm text-cyan-200/80">獲得 {state.voteCounts[state.winnerId ?? ""] ?? 0} 票肯定！</p>
          </div>
        )}

        <ul className="my-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(players).map(([id, p]) => (
            <PlayerChip
              key={id}
              avatar={p.avatar}
              nickname={p.nickname}
              score={state.currentScores?.[id] ?? 0}
              highlight={id === state.winnerId}
            />
          ))}
        </ul>

        <HostGameControls />
      </div>
    </HostShell>
  );
}
