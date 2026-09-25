"use client";

import { useEffect, useMemo, useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import { engineRoom } from "@/engine/participants";
import { TASK_TYPES, isAlive, slotDone, type AmongGameState } from "@/engine/amongUs";
import { Button } from "@/components/ui/Button";
import { PlayShell } from "@/components/game/PlayShell";
import { RoundTimer } from "@/components/game/RoundTimer";
import { vibrate, sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";

const WIRE_COLORS = [
  { name: "紅", cls: "bg-red-500" },
  { name: "藍", cls: "bg-blue-500" },
  { name: "黃", cls: "bg-yellow-400" },
  { name: "綠", cls: "bg-emerald-500" },
];

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** One self-validating mini-game. Calls onDone when the player finishes it. */
function TaskGame({ type, onDone, onClose }: { type: number; onDone: () => void; onClose: () => void }) {
  const wireOrder = useMemo(() => shuffled([0, 1, 2, 3]), []);
  const wireButtons = useMemo(() => shuffled([0, 1, 2, 3]), []);
  const code = useMemo(() => String(Math.floor(1000 + Math.random() * 9000)), []);
  const [progress, setProgress] = useState(0);
  const [typed, setTyped] = useState("");
  const [lit, setLit] = useState<boolean[]>(() => Array(6).fill(false));
  const [error, setError] = useState(false);

  const fail = () => {
    setError(true);
    vibrate([40, 40, 40]);
    setTimeout(() => setError(false), 400);
  };

  const id = TASK_TYPES[type]?.id;
  return (
    <div className={cn("rounded-3xl border border-cyan-400/30 bg-slate-900/90 p-4", error && "animate-pulse border-red-400")}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-black text-white">
          {TASK_TYPES[type]?.icon} {TASK_TYPES[type]?.name}
        </h3>
        <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/70">
          關閉
        </button>
      </div>

      {id === "wires" && (
        <>
          <p className="mb-2 text-sm text-white/70">依序點出電線顏色：</p>
          <div className="mb-4 flex justify-center gap-2">
            {wireOrder.map((c, i) => (
              <span
                key={i}
                className={cn("h-8 w-8 rounded-full border-2", WIRE_COLORS[c].cls, i < progress ? "border-white opacity-30" : "border-transparent")}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {wireButtons.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  if (wireOrder[progress] === c) {
                    vibrate(15);
                    if (progress + 1 >= wireOrder.length) onDone();
                    else setProgress(progress + 1);
                  } else {
                    setProgress(0);
                    fail();
                  }
                }}
                className={cn("h-16 rounded-2xl text-lg font-black text-black/70 active:scale-95", WIRE_COLORS[c].cls)}
              >
                {WIRE_COLORS[c].name}
              </button>
            ))}
          </div>
        </>
      )}

      {id === "code" && (
        <>
          <p className="mb-1 text-sm text-white/70">輸入密碼：</p>
          <p className="mb-2 font-mono text-3xl font-black tracking-[0.4em] text-cyan-300">{code}</p>
          <p className="mb-3 h-10 rounded-xl bg-black/50 font-mono text-3xl tracking-[0.4em] text-white">{typed}</p>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  const next = typed + n;
                  vibrate(10);
                  if (next.length < 4) return setTyped(next);
                  if (next === code) onDone();
                  else {
                    setTyped("");
                    fail();
                  }
                }}
                className={cn("h-12 rounded-xl bg-white/10 text-xl font-bold text-white active:bg-white/25", n === 0 && "col-start-2")}
              >
                {n}
              </button>
            ))}
          </div>
        </>
      )}

      {id === "fuel" && (
        <>
          <p className="mb-2 text-sm text-white/70">狂點加油，把油箱加滿！</p>
          <div className="mb-4 h-4 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-amber-400 transition-all" style={{ width: `${(progress / 15) * 100}%` }} />
          </div>
          <button
            type="button"
            onClick={() => {
              vibrate(8);
              if (progress + 1 >= 15) onDone();
              else setProgress(progress + 1);
            }}
            className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-amber-500 text-4xl active:scale-90"
          >
            ⛽
          </button>
        </>
      )}

      {id === "shields" && (
        <>
          <p className="mb-2 text-sm text-white/70">點亮全部護盾！</p>
          <div className="grid grid-cols-3 gap-3">
            {lit.map((on, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (on) return;
                  vibrate(10);
                  const next = lit.map((v, j) => (j === i ? true : v));
                  setLit(next);
                  if (next.every(Boolean)) onDone();
                }}
                className={cn("h-16 rounded-2xl text-2xl transition-all", on ? "bg-cyan-400/80" : "bg-white/10")}
              >
                🛡️
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function PlayAmongUs() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as AmongGameState | undefined;
  const players = room ? engineRoom(room).players : {};
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [fakeDone, setFakeDone] = useState<number[]>([]);
  const [peek, setPeek] = useState(false);
  const [confirmKill, setConfirmKill] = useState<string | null>(null);

  useEffect(() => {
    setOpenSlot(null);
    setConfirmKill(null);
  }, [state?.phase]);
  useEffect(() => setFakeDone([]), [room?.startedAt]);

  if (!state || !player) return null;
  const me = player.id;
  const alive = isAlive(state, me);
  const impostor = state.impostorIds.includes(me);
  const mates = state.impostorIds.filter((id) => id !== me);
  const myTasks = state.tasks[me] ?? [];
  const done = (slot: number) => (impostor ? fakeDone.includes(slot) : slotDone(state, me, slot));
  const cooldown = state.killCooldowns[me] ?? 0;
  const name = (id: string) => `${players[id]?.avatar ?? ""} ${players[id]?.nickname ?? "玩家"}`;
  const ids = Object.keys(players);

  const send = async (action: unknown, fail = "操作失敗，請再試一次") => {
    try {
      await submitAction(action);
    } catch {
      toast(fail);
    }
  };

  const completeSlot = (slot: number) => {
    setOpenSlot(null);
    sfx.playReady();
    vibrate(30);
    if (impostor) setFakeDone((list) => [...list, slot]);
    else void send({ type: "completeTask", slot });
  };

  const roleCard = (
    <button
      type="button"
      onPointerDown={() => setPeek(true)}
      onPointerUp={() => setPeek(false)}
      onPointerLeave={() => setPeek(false)}
      className="w-full select-none rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/70"
    >
      {peek ? (
        <span className={impostor ? "font-black text-red-400" : "font-black text-cyan-300"}>
          {impostor ? `🔪 你是內鬼${mates.length ? `（同夥：${mates.map(name).join("、")}）` : ""}` : "🧑‍🚀 你是船員"}
        </span>
      ) : (
        "按住偷看身分 👁️"
      )}
    </button>
  );

  return (
    <PlayShell round={state.currentRound > 0 ? `第 ${state.currentRound} 輪` : undefined}>
      <div className="space-y-4 text-center">
        {state.phase === "roles" && (
          <div className={cn("rounded-3xl border p-8", impostor ? "border-red-500/50 bg-red-950/50" : "border-cyan-400/50 bg-cyan-950/40")}>
            <p className="mb-3 text-7xl" aria-hidden="true">
              {impostor ? "🔪" : "🧑‍🚀"}
            </p>
            <h1 className={cn("text-3xl font-black", impostor ? "text-red-400" : "text-cyan-300")}>
              {impostor ? "你是內鬼" : "你是船員"}
            </h1>
            <p className="mt-3 text-sm text-white/70">
              {impostor
                ? "假裝做任務，趁沒人注意淘汰船員。別被發現！"
                : "完成手機上的任務，找出藏在大家之中的內鬼！"}
            </p>
            {impostor && mates.length > 0 && <p className="mt-2 text-sm text-red-300">同夥：{mates.map(name).join("、")}</p>}
            <p className="mt-4 text-xs text-white/50">別讓旁邊的人看到你的螢幕 🤫</p>
          </div>
        )}

        {state.phase === "tasks" && (
          <>
            {!alive && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-4xl" aria-hidden="true">
                  👻
                </p>
                <p className="font-black text-white">你已經被淘汰了</p>
                <p className="text-xs text-white/60">幽靈不能說話或投票{impostor ? "。" : "，但還可以繼續做任務幫隊友！"}</p>
              </div>
            )}
            {roleCard}
            <div className="text-left">
              <div className="mb-1 flex justify-between text-xs font-bold text-white/60">
                <span>全船任務進度</span>
                <span>
                  {state.tasksCompleted} / {state.tasksTotal}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-emerald-400 transition-all" style={{ width: `${(state.tasksCompleted / Math.max(1, state.tasksTotal)) * 100}%` }} />
              </div>
            </div>

            {openSlot !== null && (alive || !impostor) ? (
              <TaskGame key={openSlot} type={myTasks[openSlot]} onDone={() => completeSlot(openSlot)} onClose={() => setOpenSlot(null)} />
            ) : (
              (alive || !impostor) && (
                <div className="grid grid-cols-2 gap-3">
                  {myTasks.map((t, slot) => (
                    <button
                      key={slot}
                      type="button"
                      disabled={done(slot)}
                      onClick={() => setOpenSlot(slot)}
                      className={cn(
                        "rounded-2xl border p-3 text-left transition-all active:scale-95",
                        done(slot) ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200" : "border-white/15 bg-white/5 text-white",
                      )}
                    >
                      <span className="text-2xl">{TASK_TYPES[t]?.icon}</span>
                      <span className="block text-sm font-bold">{TASK_TYPES[t]?.name}</span>
                      <span className="text-xs">{done(slot) ? "✅ 完成" : "點我開始"}</span>
                    </button>
                  ))}
                </div>
              )
            )}

            {impostor && alive && openSlot === null && (
              <div className="rounded-2xl border border-red-500/40 bg-red-950/40 p-3 text-left">
                <p className="mb-2 text-sm font-black text-red-300">
                  🔪 淘汰{cooldown > 0 ? `（冷卻 ${cooldown} 秒）` : "（可以動手了）"}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ids
                    .filter((id) => isAlive(state, id) && !state.impostorIds.includes(id))
                    .map((id) => (
                      <button
                        key={id}
                        type="button"
                        disabled={cooldown > 0}
                        onClick={() => {
                          if (confirmKill !== id) return setConfirmKill(id);
                          setConfirmKill(null);
                          vibrate(50);
                          void send({ type: "kill", targetId: id });
                        }}
                        className={cn(
                          "truncate rounded-xl border px-2 py-2 text-sm font-bold disabled:opacity-40",
                          confirmKill === id ? "border-red-400 bg-red-600 text-white" : "border-white/10 bg-white/5 text-white",
                        )}
                      >
                        {confirmKill === id ? "再按一次確認" : name(id)}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {alive && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="ghost"
                  size="lg"
                  disabled={state.bodies.length === 0 || state.reportDelay > 0}
                  onClick={() => void send({ type: "report" })}
                >
                  📢 回報屍體
                </Button>
                <Button
                  variant="accent"
                  size="lg"
                  disabled={Boolean(state.emergencyUsed[me])}
                  onClick={() => void send({ type: "emergency" })}
                >
                  🚨 緊急會議
                </Button>
              </div>
            )}
            <RoundTimer timeLeft={state.timeLeft} total={Math.max(45, room?.settings?.timer ?? 75)} endLabel="自動召開會議" compact />
          </>
        )}

        {(state.phase === "discussion" || state.phase === "voting") && (
          <>
            <div className="rounded-2xl border border-amber-400/40 bg-amber-950/30 p-4">
              <p className="text-3xl" aria-hidden="true">
                {state.meetingReason === "report" ? "📢" : "🚨"}
              </p>
              <h2 className="text-xl font-black text-white">
                {state.meetingReason === "report"
                  ? `${name(state.meetingCallerId ?? "")} 回報了屍體！`
                  : state.meetingReason === "emergency"
                    ? `${name(state.meetingCallerId ?? "")} 召開緊急會議！`
                    : "任務時間到，全員開會！"}
              </h2>
              {state.meetingBodies.length > 0 && (
                <p className="mt-1 text-sm text-red-300">💀 被淘汰：{state.meetingBodies.map(name).join("、")}</p>
              )}
              <p className="mt-2 text-xs text-white/60">
                {state.phase === "discussion" ? "先面對面討論，也可以直接投票" : "投票時間！"}
              </p>
            </div>
            {!alive ? (
              <p className="text-sm text-white/60">👻 幽靈不能投票，靜靜看戲吧。</p>
            ) : state.votes[me] ? (
              <p className="rounded-2xl bg-white/5 p-4 font-bold text-emerald-300">
                ✓ 已投給 {state.votes[me] === "skip" ? "跳過" : name(state.votes[me])}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {ids
                  .filter((id) => isAlive(state, id))
                  .map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => void send({ type: "vote", targetId: id }, "投票失敗，請再試一次")}
                      className="truncate rounded-xl border border-white/15 bg-white/5 px-2 py-3 text-sm font-bold text-white active:scale-95"
                    >
                      {name(id)}
                      {id === me && "（你）"}
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => void send({ type: "vote", targetId: "skip" }, "投票失敗，請再試一次")}
                  className="col-span-2 rounded-xl border border-white/15 bg-white/10 py-3 text-sm font-bold text-white/80"
                >
                  ⏭️ 跳過投票
                </button>
              </div>
            )}
            <RoundTimer
              timeLeft={state.timeLeft}
              total={state.phase === "discussion" ? 30 : 25}
              endLabel={state.phase === "discussion" ? "開始投票" : "投票截止"}
              compact
            />
          </>
        )}

        {state.phase === "ejected" && (
          <div className="py-8">
            <p className="mb-3 text-6xl" aria-hidden="true">
              {state.ejectedId ? "🚀" : "🤷"}
            </p>
            <h2 className="text-2xl font-black text-white">
              {state.ejectedId ? `${name(state.ejectedId)} 被放逐了` : "沒有人被放逐"}
            </h2>
            {state.ejectedId && (
              <p className={cn("mt-2 text-lg font-bold", state.ejectedWasImpostor ? "text-emerald-300" : "text-red-300")}>
                {state.ejectedWasImpostor ? "他是內鬼！" : "他不是內鬼……"}
              </p>
            )}
          </div>
        )}

        {state.phase === "result" && (
          <div className="py-8">
            <p className="mb-3 text-6xl" aria-hidden="true">
              {state.winnerIds.includes(me) ? "🏆" : "💀"}
            </p>
            <h2 className="text-2xl font-black text-white">
              {state.winnerTeam === "impostor" ? "內鬼獲勝！" : state.winnerTeam === "crew" ? "船員獲勝！" : "遊戲結束"}
            </h2>
            {state.winReason && <p className="mt-2 text-sm text-white/70">{state.winReason}</p>}
            <p className="mt-3 text-sm text-red-300">內鬼是：{state.impostorIds.map(name).join("、")}</p>
          </div>
        )}
      </div>
    </PlayShell>
  );
}
