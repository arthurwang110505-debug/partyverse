"use client";

import { useMemo, useState } from "react";
import { Eye, Lock, Moon, Shield, Skull, Sun } from "lucide-react";
import { engineRoom } from "@/engine/participants";
import { ROLE_META, type WerewolfGameState, type WerewolfRole } from "@/engine/werewolf";
import { useRoom } from "@/providers/RoomContext";
import { useSubmitAction } from "@/hooks/useSubmitAction";
import { useGameViewState } from "@/hooks/useGameViewState";
import { PlayShell } from "@/components/game/PlayShell";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Button } from "@/components/ui/Button";
import { vibrate, sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { screenNoun } from "@/lib/hostMode";

type WerewolfPhoneState = WerewolfGameState & {
  myRole?: WerewolfRole;
  fellowWolves?: string[];
  mySeerResults?: Record<string, "werewolf" | "good">;
};

export default function PlayWerewolf() {
  const { room, player } = useRoom();
  const submit = useSubmitAction();
  const state = useGameViewState<WerewolfPhoneState>();
  const players = room ? engineRoom(room).players : {};

  const [revealed, setRevealed] = useState(false);
  const [confirmVoteId, setConfirmVoteId] = useState<string | null>(null);
  const [poisonMode, setPoisonMode] = useState(false);

  const voteCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const target of Object.values(state?.votes ?? {})) {
      if (target && target !== "abstain") counts[target] = (counts[target] ?? 0) + 1;
    }
    return counts;
  }, [state?.votes]);

  if (!state || !player) return null;

  const myRole: WerewolfRole = state.myRole ?? state.roles?.[player.id] ?? "villager";
  const roleMeta = ROLE_META[myRole];
  const isEliminated = state.eliminatedPlayerIds?.includes(player.id);
  const fellowWolves: string[] =
    myRole === "werewolf"
      ? state.fellowWolves ??
        Object.entries(state.roles ?? {})
          .filter(([, r]) => r === "werewolf")
          .map(([id]) => id)
      : [];
  const seerResults =
    myRole === "seer" ? state.mySeerResults ?? state.seerChecks ?? {} : {};
  const witchVictimId = myRole === "witch" ? state.nightVictimId : null;

  const livingOthers = Object.entries(players).filter(
    ([id]) => id !== player.id && !state.eliminatedPlayerIds.includes(id),
  );
  const livingAll = Object.entries(players).filter(([id]) => !state.eliminatedPlayerIds.includes(id));

  const myDayVote = state.votes?.[player.id];
  const myWolfVote = myRole === "werewolf" ? state.wolfVotes?.[player.id] : undefined;
  const iAmReadyToVote = Boolean(state.readyToVote?.[player.id]);

  // Hunter can act during hunter_shot even though they were just added to eliminatedPlayerIds
  const isActingHunter = state.phase === "hunter_shot" && state.hunterPendingId === player.id;

  if (isEliminated && !isActingHunter && state.phase !== "result") {
    return (
      <PlayShell round={`第 ${state.currentRound} 回合`}>
        <div className="py-10 text-center">
          <p className="mb-2 text-6xl" aria-hidden="true">
            💀
          </p>
          <h2 className="text-xl font-bold text-red-400">你已出局</h2>
          <p className="mt-2 text-sm text-white/60">
            你的身分是：<strong className="text-white">{roleMeta.icon} {roleMeta.name}</strong>
          </p>
          <p className="mt-2 text-xs text-white/50">請保持緘默，不要提示場上玩家，觀看{screenNoun(room)}戰況！</p>
        </div>
      </PlayShell>
    );
  }

  return (
    <PlayShell round={`第 ${state.currentRound} 回合`}>
      <div className="pt-2 text-center">
        {/* Hold-to-reveal secret identity card */}
        <div
          role="button"
          tabIndex={0}
          aria-pressed={revealed}
          onPointerDown={() => {
            vibrate(15);
            setRevealed(true);
          }}
          onPointerUp={() => setRevealed(false)}
          onPointerLeave={() => setRevealed(false)}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") setRevealed(true);
          }}
          onKeyUp={() => setRevealed(false)}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "relative mb-5 cursor-pointer select-none overflow-hidden rounded-3xl border p-5 text-center shadow-xl transition-all duration-200",
            revealed
              ? "scale-[1.02] border-rose-400/80 bg-rose-950/50 ring-4 ring-rose-500/20"
              : "border-white/15 bg-white/5 hover:bg-white/10 active:scale-[0.98]",
          )}
        >
          <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-semibold tracking-wider text-rose-300">
            {revealed ? (
              <>
                <Eye className="h-4 w-4 animate-pulse" aria-hidden="true" />
                放開手指立即隱藏身分
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" aria-hidden="true" />
                防偷窺卡片 · 按住查看你的身分
              </>
            )}
          </div>

          {revealed ? (
            <div className="animate-scale-in space-y-2">
              <p className="text-3xl font-black text-white">
                {roleMeta.icon} {roleMeta.name}
              </p>
              <p className="text-xs leading-relaxed text-white/75">{roleMeta.summary}</p>
              {myRole === "werewolf" && fellowWolves.length > 1 && (
                <p className="rounded-xl bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-200">
                  狼人隊友：{fellowWolves.map((id) => players[id]?.nickname ?? id).join("、")}
                </p>
              )}
              {myRole === "seer" && Object.keys(seerResults).length > 0 && (
                <div className="rounded-xl bg-indigo-500/20 p-2 text-left text-xs text-indigo-100">
                  <p className="mb-1 font-bold">已查驗紀錄：</p>
                  {Object.entries(seerResults).map(([id, res]) => (
                    <p key={id}>
                      • {players[id]?.nickname ?? id} → {res === "werewolf" ? "🐺 狼人" : "😇 好人"}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-2 text-white/40">
              <p className="text-2xl font-bold tracking-widest blur-sm select-none">••••••</p>
              <p className="mt-1 text-[11px] text-white/50">按住不放以查看角色與技能</p>
            </div>
          )}
        </div>

        {state.phase === "role_reveal" && (
          <div className="glass rounded-2xl border border-white/10 p-4">
            <p className="text-sm font-bold text-white">記好你的陣營與技能！</p>
            <p className="mt-1 text-xs leading-relaxed text-white/60">
              確認完成後即進入黑夜，請聽從{screenNoun(room)}指示閉眼或行動。
            </p>
          </div>
        )}

        {/* Night: Werewolf */}
        {state.phase === "night_werewolf" && (
          <div className="space-y-3">
            {myRole === "werewolf" ? (
              <div className="glass rounded-2xl border border-red-500/30 bg-red-950/30 p-4">
                <p className="mb-1 flex items-center justify-center gap-1.5 text-sm font-bold text-red-300">
                  <Moon className="h-4 w-4" /> 狼人行動：選擇今晚獵殺目標
                </p>
                <p className="mb-3 text-xs text-white/60">
                  {myWolfVote ? `已鎖定 ${players[myWolfVote]?.nickname}，等待其他狼隊友…` : "點選要襲擊的玩家"}
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {livingAll.map(([id, p]) => (
                    <button
                      key={id}
                      type="button"
                      disabled={Boolean(myWolfVote)}
                      onClick={() => {
                        vibrate(20);
                        sfx.playPop();
                        void submit({ type: "wolfVote", targetPlayerId: id });
                      }}
                      className={cn(
                        "min-h-[4.5rem] rounded-2xl border p-3 text-center transition-all active:scale-95",
                        myWolfVote === id
                          ? "border-red-400 bg-red-500/30 ring-2 ring-red-400"
                          : "border-white/10 bg-white/5 hover:bg-white/10",
                      )}
                    >
                      <span className="block text-2xl" aria-hidden="true">
                        {p.avatar}
                      </span>
                      <span className="mt-1 block truncate text-xs font-bold">{p.nickname}</span>
                      {fellowWolves.includes(id) && (
                        <span className="text-[10px] text-red-300">（狼隊友）</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="glass rounded-2xl border border-indigo-400/20 bg-indigo-950/30 p-6">
                <p className="mb-2 text-4xl" aria-hidden="true">
                  🌙
                </p>
                <p className="text-sm font-bold text-indigo-200">天黑請閉眼…</p>
                <p className="mt-1 text-xs text-white/55">狼人正在暗中挑選目標，請保持安靜！</p>
              </div>
            )}
          </div>
        )}

        {/* Night: Seer */}
        {state.phase === "night_seer" && (
          <div className="space-y-3">
            {myRole === "seer" ? (
              <div className="glass rounded-2xl border border-indigo-400/40 bg-indigo-950/40 p-4">
                <p className="mb-1 text-sm font-bold text-indigo-200">🔮 預言家行動：選擇一人查驗陣營</p>
                <p className="mb-3 text-xs text-white/60">查驗後將立即保存於上方秘密卡片中</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {livingOthers.map(([id, p]) => {
                    const checked = seerResults[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={state.seerCheckedThisNight}
                        onClick={() => {
                          vibrate(20);
                          sfx.playChime();
                          void submit({ type: "seerCheck", targetPlayerId: id });
                        }}
                        className="min-h-[4.5rem] rounded-2xl border border-white/10 bg-white/5 p-3 text-center transition-all hover:bg-white/10 active:scale-95"
                      >
                        <span className="block text-2xl" aria-hidden="true">
                          {p.avatar}
                        </span>
                        <span className="mt-1 block truncate text-xs font-bold">{p.nickname}</span>
                        {checked && (
                          <span className="mt-0.5 block text-[10px] text-indigo-200">
                            已驗：{checked === "werewolf" ? "🐺 狼人" : "😇 好人"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="glass rounded-2xl border border-indigo-400/20 bg-indigo-950/30 p-6">
                <p className="mb-2 text-4xl" aria-hidden="true">
                  🔮
                </p>
                <p className="text-sm font-bold text-indigo-200">天黑請閉眼…</p>
                <p className="mt-1 text-xs text-white/55">預言家正在查驗身分…</p>
              </div>
            )}
          </div>
        )}

        {/* Night: Witch */}
        {state.phase === "night_witch" && (
          <div className="space-y-3">
            {myRole === "witch" ? (
              <div className="glass space-y-4 rounded-2xl border border-emerald-400/35 bg-emerald-950/30 p-4">
                <p className="text-sm font-bold text-emerald-200">🧪 女巫行動</p>
                {state.witchAntidoteLeft && witchVictimId && (
                  <div className="rounded-xl border border-red-400/30 bg-red-950/40 p-3 text-xs text-white">
                    昨晚遭狼人襲擊的是：<strong className="text-red-300">{players[witchVictimId]?.nickname}</strong>
                  </div>
                )}
                {!poisonMode ? (
                  <div className="grid gap-2">
                    {state.witchAntidoteLeft && witchVictimId && (
                      <Button
                        variant="accent"
                        size="md"
                        onClick={() => {
                          vibrate(20);
                          sfx.playSuccess();
                          void submit({ type: "witchAction", choice: "save" });
                        }}
                      >
                        💊 使用解藥救回 {players[witchVictimId]?.nickname}
                      </Button>
                    )}
                    {state.witchPoisonLeft && (
                      <Button variant="danger" size="md" onClick={() => setPoisonMode(true)}>
                        ☠️ 使用毒藥毒殺一人
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={() => {
                        vibrate(10);
                        void submit({ type: "witchAction", choice: "skip" });
                      }}
                    >
                      今晚不使用藥水（跳過）
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-rose-300">選擇要毒殺的玩家：</p>
                    <div className="grid grid-cols-2 gap-2">
                      {livingOthers.map(([id, p]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            vibrate(25);
                            sfx.playBuzzer();
                            setPoisonMode(false);
                            void submit({ type: "witchAction", choice: "poison", targetPlayerId: id });
                          }}
                          className="rounded-xl border border-rose-400/30 bg-rose-950/40 p-3 text-center hover:bg-rose-900/50"
                        >
                          <span className="block text-2xl">{p.avatar}</span>
                          <span className="mt-1 block truncate text-xs font-bold">{p.nickname}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="text-xs text-white/60 underline"
                      onClick={() => setPoisonMode(false)}
                    >
                      返回女巫選單
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass rounded-2xl border border-indigo-400/20 bg-indigo-950/30 p-6">
                <p className="mb-2 text-4xl" aria-hidden="true">
                  🧪
                </p>
                <p className="text-sm font-bold text-indigo-200">天黑請閉眼…</p>
                <p className="mt-1 text-xs text-white/55">女巫正在決定是否使用藥水…</p>
              </div>
            )}
          </div>
        )}

        {/* Hunter Shot */}
        {state.phase === "hunter_shot" && (
          <div className="space-y-3">
            {isActingHunter ? (
              <div className="glass space-y-3 rounded-2xl border border-amber-400/50 bg-amber-950/40 p-4">
                <p className="text-sm font-bold text-amber-200">🏹 你已出局！開槍帶走一名玩家</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {livingOthers.map(([id, p]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        vibrate(30);
                        sfx.playBoom();
                        void submit({ type: "hunterShoot", targetPlayerId: id });
                      }}
                      className="rounded-2xl border border-amber-400/30 bg-amber-500/15 p-3 text-center active:scale-95"
                    >
                      <span className="block text-2xl">{p.avatar}</span>
                      <span className="mt-1 block truncate text-xs font-bold">{p.nickname}</span>
                    </button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={() => void submit({ type: "hunterShoot", targetPlayerId: null })}>
                  不開槍，直接倒下
                </Button>
              </div>
            ) : (
              <div className="glass rounded-2xl border border-amber-400/30 bg-amber-950/30 p-5">
                <p className="text-sm font-bold text-amber-200">🏹 獵人發動技能中…</p>
                <p className="mt-1 text-xs text-white/60">等待獵人選擇開槍目標</p>
              </div>
            )}
          </div>
        )}

        {/* Day Announce */}
        {state.phase === "day_announce" && (
          <div className="glass rounded-2xl border border-amber-300/30 bg-amber-950/20 p-5">
            <Sun className="mx-auto mb-2 h-8 w-8 text-amber-300" aria-hidden="true" />
            <p className="text-sm font-bold text-white">
              {state.lastNightDeaths.length === 0
                ? "昨晚是平安夜，無人死亡！"
                : `昨晚倒下：${state.lastNightDeaths.map((id) => players[id]?.nickname ?? id).join("、")}`}
            </p>
            <p className="mt-1 text-xs text-white/60">即將進入自由發言討論…</p>
          </div>
        )}

        {/* Day Discussion */}
        {state.phase === "day_discussion" && (
          <div className="glass space-y-3 rounded-2xl border border-white/10 p-4">
            <p className="text-sm font-bold text-amber-300">🗣️ 白天討論階段</p>
            <p className="text-xs leading-relaxed text-white/65">
              輪流發言分享你的推理。好人找出破綻，狼人注意圓謊！
            </p>
            <RoundTimer
              compact
              haptic
              timeLeft={state.timeLeft}
              total={Math.max(30, room?.settings?.timer ?? 60)}
              endLabel="進入投票"
            />
            <Button
              variant={iAmReadyToVote ? "ghost" : "primary"}
              size="md"
              disabled={iAmReadyToVote}
              onClick={() => {
                vibrate(15);
                void submit({ type: "readyVote" });
              }}
              className="w-full"
            >
              {iAmReadyToVote ? "✓ 已準備好投票，等待其他人" : "結束發言・直接投票"}
            </Button>
          </div>
        )}

        {/* Day Voting */}
        {state.phase === "day_voting" && (
          <div className="py-1">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-white/85">
                {myDayVote
                  ? "✓ 已投票，等待大家開票"
                  : confirmVoteId
                    ? "再點一次確認放逐此人"
                    : "投票放逐一名嫌疑犯："}
              </p>
              <RoundTimer compact haptic timeLeft={state.timeLeft} total={20} endLabel="開票" className="w-24" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {livingAll.map(([id, p]) => {
                const selected = myDayVote === id || confirmVoteId === id;
                const tally = voteCounts[id] ?? 0;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={Boolean(myDayVote)}
                    aria-pressed={selected}
                    onClick={() => {
                      if (myDayVote) return;
                      if (confirmVoteId === id) {
                        vibrate(20);
                        sfx.playPop();
                        setConfirmVoteId(null);
                        void submit({ type: "vote", targetPlayerId: id });
                      } else {
                        vibrate(10);
                        setConfirmVoteId(id);
                      }
                    }}
                    className={cn(
                      "relative min-h-[5.25rem] rounded-2xl border p-3 text-center transition-all active:scale-95",
                      myDayVote === id
                        ? "border-rose-400 bg-rose-500/25 ring-2 ring-rose-400"
                        : confirmVoteId === id
                          ? "border-amber-400 bg-amber-500/20 ring-2 ring-amber-400"
                          : "border-white/10 bg-white/5 hover:bg-white/10",
                    )}
                  >
                    <span className="block text-3xl" aria-hidden="true">
                      {p.avatar}
                    </span>
                    <span className="mt-1 block truncate text-sm font-bold">{p.nickname}</span>
                    {id === player.id && <span className="text-[10px] text-white/40">（自己）</span>}
                    {myDayVote === id && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-rose-200">
                        <Skull className="h-3 w-3" /> 已投此人
                      </span>
                    )}
                    {confirmVoteId === id && !myDayVote && (
                      <span className="mt-1 block text-[10px] font-bold text-amber-200">再點一次確認</span>
                    )}
                    {tally > 0 && myDayVote && (
                      <span className="absolute right-2 top-2 rounded-full bg-black/60 px-1.5 text-[10px] tabular-nums">
                        {tally}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {!myDayVote && (
              <div className="mt-3 flex items-center justify-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    vibrate(10);
                    setConfirmVoteId(null);
                    void submit({ type: "vote", targetPlayerId: "abstain" });
                  }}
                >
                  棄權不投
                </Button>
                {confirmVoteId && (
                  <button
                    type="button"
                    className="text-xs text-white/50 underline"
                    onClick={() => setConfirmVoteId(null)}
                  >
                    取消選擇
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Day Exile */}
        {state.phase === "day_exile" && (
          <div className="glass rounded-2xl border border-white/15 p-5">
            <Shield className="mx-auto mb-2 h-8 w-8 text-amber-300" aria-hidden="true" />
            <p className="text-sm font-bold text-white">
              {state.lastExiledId
                ? `${players[state.lastExiledId]?.nickname} 被放逐出局`
                : "平票／棄權，無人被放逐"}
            </p>
            <p className="mt-1 text-xs text-white/55">即將進入下一個黑夜…</p>
          </div>
        )}

        {state.phase === "result" && (
          <div className="glass rounded-2xl border border-rose-400/30 bg-rose-950/30 p-5">
            <p className="text-4xl" aria-hidden="true">
              {state.winnerTeam === "werewolves" ? "🐺" : "☀️"}
            </p>
            <p className="mt-2 text-sm font-bold text-white">
              遊戲結束！看{screenNoun(room)}揭曉全場身分與得分！
            </p>
          </div>
        )}
      </div>
    </PlayShell>
  );
}
