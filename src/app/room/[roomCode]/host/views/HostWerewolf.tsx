"use client";

import { useEffect } from "react";
import { engineRoom } from "@/engine/participants";
import { ROLE_META, type WerewolfGameState } from "@/engine/werewolf";
import { useRoom } from "@/providers/RoomContext";
import { useGameViewState } from "@/hooks/useGameViewState";
import { HostGameControls } from "@/components/game/HostGameControls";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Confetti } from "@/components/game/Confetti";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";

export default function HostWerewolf() {
  const { room } = useRoom();
  const state = useGameViewState<WerewolfGameState>();
  const players = room ? engineRoom(room).players : {};
  const phase = state?.phase;

  useEffect(() => {
    if (phase === "day_announce" && (state?.lastNightDeaths?.length ?? 0) > 0) {
      sfx.playBoom();
    } else if (phase === "day_exile" && state?.lastExiledId) {
      sfx.playBoom();
    } else if (phase === "result") {
      sfx.playFanfare();
    }
  }, [phase, state?.lastNightDeaths?.length, state?.lastExiledId]);

  if (!state) return null;

  const isNight =
    state.phase === "night_werewolf" || state.phase === "night_seer" || state.phase === "night_witch";
  const timed = state.phase !== "result";
  const livingPlayerIds = Object.keys(players).filter((id) => !state.eliminatedPlayerIds.includes(id));
  const voteCount = Object.keys(state.votes ?? {}).length;
  const readyVoteCount = Object.keys(state.readyToVote ?? {}).length;

  const timerTotal = (() => {
    const diff = room?.settings?.difficulty ?? "easy";
    const sub = diff === "hard" ? 5 : diff === "medium" ? 2 : 0;
    if (state.phase === "role_reveal") return 10;
    if (state.phase === "night_werewolf") return Math.max(10, 20 - sub);
    if (state.phase === "night_seer") return Math.max(10, 15 - sub);
    if (state.phase === "night_witch") return Math.max(10, 18 - sub);
    if (state.phase === "hunter_shot") return 15;
    if (state.phase === "day_announce") return 7;
    if (state.phase === "day_discussion") return Math.max(30, room?.settings?.timer ?? 60);
    if (state.phase === "day_voting") return 20;
    if (state.phase === "day_exile") return 6;
    return 10;
  })();

  return (
    <HostShell>
      {state.phase === "result" && <Confetti />}

      <div
        className={cn(
          "mx-auto max-w-4xl rounded-3xl p-4 text-center transition-colors duration-500 sm:p-6",
          isNight && "border border-indigo-500/30 bg-gradient-to-b from-slate-950/90 via-indigo-950/50 to-black/80",
        )}
      >
        <header className="mb-6">
          <p className="mb-2 text-sm font-semibold tracking-wider text-rose-400">
            第 {state.currentRound} 夜 / 晝 · 狼人殺
          </p>
          <h1 className="px-4 text-3xl font-black text-white md:text-5xl">
            {state.phase === "role_reveal" && "🤫 請全體玩家私密查看自己的身分牌"}
            {state.phase === "night_werewolf" && "🌙 天黑請閉眼 · 狼人請睜眼"}
            {state.phase === "night_seer" && "🔮 狼人請閉眼 · 預言家請睜眼"}
            {state.phase === "night_witch" && "🧪 預言家請閉眼 · 女巫請睜眼"}
            {state.phase === "hunter_shot" && "🏹 獵人臨終開槍！"}
            {state.phase === "day_announce" && "☀️ 天亮了！公佈昨夜結果"}
            {state.phase === "day_discussion" && "🗣️ 白天自由發言與辯論"}
            {state.phase === "day_voting" && "🗳️ 放逐投票時間！誰是狼人？"}
            {state.phase === "day_exile" && "⚖️ 投票放逐揭曉"}
            {state.phase === "result" && "🏆 勝負揭曉！"}
          </h1>
        </header>

        {timed && (
          <div className="my-6">
            <div className="mx-auto mb-6 max-w-md">
              <RoundTimer timeLeft={state.timeLeft} total={timerTotal} endLabel="進入下一階段" />
            </div>

            {isNight && (
              <div className="mx-auto max-w-lg rounded-2xl border border-indigo-400/30 bg-indigo-950/50 p-5">
                <p className="mb-2 text-4xl" aria-hidden="true">
                  {state.phase === "night_werewolf" ? "🐺" : state.phase === "night_seer" ? "🔮" : "🧪"}
                </p>
                <p className="text-base font-bold text-indigo-100">
                  {state.phase === "night_werewolf" && "狼人正在手機上選擇今晚的獵殺目標…"}
                  {state.phase === "night_seer" && "預言家正在手機上查驗一名玩家的真實身分…"}
                  {state.phase === "night_witch" && "女巫正在決定是否使用解藥或毒藥…"}
                </p>
                <p className="mt-1 text-xs text-indigo-200/60">請其他玩家保持安靜閉眼，切勿偷看鄰居螢幕</p>
              </div>
            )}

            {state.phase === "role_reveal" && (
              <p className="text-white/70">按住手機上的神秘卡片即可偷看身分，放開自動隱藏！</p>
            )}

            {state.phase === "hunter_shot" && (
              <div className="mx-auto max-w-md rounded-2xl border border-amber-500/40 bg-amber-950/40 p-5">
                <p className="text-lg font-bold text-amber-200">
                  {players[state.hunterPendingId ?? ""]?.nickname ?? "獵人"} 亮出獵人牌！正在鎖定開槍目標…
                </p>
              </div>
            )}

            {state.phase === "day_announce" && (
              <div
                className={cn(
                  "mx-auto max-w-lg animate-scale-in rounded-3xl border p-6 shadow-xl",
                  state.lastNightDeaths.length === 0
                    ? "border-emerald-500/40 bg-emerald-950/40"
                    : "border-red-500/40 bg-red-950/40",
                )}
              >
                <p className="mb-2 text-5xl" aria-hidden="true">
                  {state.lastNightDeaths.length === 0 ? "🕊️" : "💀"}
                </p>
                {state.lastNightDeaths.length === 0 ? (
                  <h2 className="text-2xl font-black text-emerald-300">昨晚是平安夜，無人倒下！</h2>
                ) : (
                  <>
                    <h2 className="text-2xl font-black text-red-300">
                      昨晚倒下：{state.lastNightDeaths.map((id) => players[id]?.nickname ?? id).join("、")}
                    </h2>
                    <p className="mt-1 text-sm text-white/70">請死者保持沉默，其餘玩家準備推理發言！</p>
                  </>
                )}
                {state.lastHunterTargetId && (
                  <p className="mt-3 rounded-xl bg-amber-500/20 px-3 py-2 text-sm font-bold text-amber-200">
                    🏹 獵人開槍帶走了 {players[state.lastHunterTargetId]?.nickname}！
                  </p>
                )}
              </div>
            )}

            {state.phase === "day_discussion" && (
              <div className="mx-auto max-w-md space-y-2">
                <p className="text-white/75">輪流發言分析線索；所有人都準備好可直接點擊手機「進入投票」。</p>
                <p className="text-xs font-semibold text-amber-300">
                  已有 {readyVoteCount} / {livingPlayerIds.length} 位存活玩家準備投票
                </p>
              </div>
            )}

            {state.phase === "day_voting" && (
              <div className="mx-auto max-w-md">
                <div className="mb-2 flex items-center justify-between text-sm font-semibold text-rose-300">
                  <span>放逐投票進度</span>
                  <span>
                    {voteCount} / {livingPlayerIds.length} 票
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-purple-500 transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (voteCount / Math.max(1, livingPlayerIds.length)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {state.phase === "day_exile" && (
              <div
                className={cn(
                  "mx-auto max-w-lg animate-scale-in rounded-3xl border p-6 shadow-xl",
                  state.lastExiledId
                    ? "border-red-500/40 bg-red-950/40"
                    : "border-amber-500/40 bg-amber-950/40",
                )}
              >
                <p className="mb-2 text-5xl" aria-hidden="true">
                  {state.lastExiledId ? "⚖️" : "🤝"}
                </p>
                <h2 className="text-2xl font-black text-white">
                  {state.lastExiledId
                    ? `${players[state.lastExiledId]?.nickname} 被投票放逐出局！`
                    : "平票／棄權！本輪無人被放逐"}
                </h2>
                {state.lastHunterTargetId && (
                  <p className="mt-2 text-sm font-bold text-amber-300">
                    🏹 獵人開槍帶走了 {players[state.lastHunterTargetId]?.nickname}！
                  </p>
                )}
                <p className="mt-1 text-sm text-white/60">黑夜即將再次降臨…</p>
              </div>
            )}
          </div>
        )}

        {state.phase === "result" && (
          <div className="my-8 space-y-6">
            <div className="inline-block animate-scale-in rounded-3xl border border-rose-500/40 bg-rose-950/40 p-6 shadow-2xl sm:p-8">
              <p className="mb-2 text-6xl" aria-hidden="true">
                {state.winnerTeam === "werewolves" ? "🐺" : "☀️"}
              </p>
              <h2 className="mb-2 text-3xl font-black text-yellow-300">
                {state.winnerTeam === "werewolves" ? "狼人陣營獲勝！黑夜吞噬村莊！" : "好人陣營獲勝！全場狼人已伏法！"}
              </h2>
              <p className="text-sm text-white/70">所有玩家真實身分大公開</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {Object.entries(players).map(([id, p]) => {
                const role = state.roles?.[id] ?? "villager";
                const meta = ROLE_META[role];
                const isOut = state.eliminatedPlayerIds.includes(id);
                return (
                  <div
                    key={id}
                    className={cn(
                      "rounded-2xl border p-3 text-center",
                      role === "werewolf"
                        ? "border-red-500/50 bg-red-950/40"
                        : "border-emerald-500/30 bg-emerald-950/20",
                      isOut && "opacity-75",
                    )}
                  >
                    <p className="text-2xl" aria-hidden="true">
                      {p.avatar}
                    </p>
                    <p className="mt-1 truncate text-sm font-bold text-white">{p.nickname}</p>
                    <p className="mt-1 text-xs font-bold text-yellow-200">
                      {meta.icon} {meta.name}
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/50">{isOut ? "已出局" : "存活"}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {state.phase !== "result" && (
          <ul className="my-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(players).map(([id, p]) => {
              const isOut = state.eliminatedPlayerIds.includes(id);
              const hasVoted = Boolean(state.votes?.[id]);
              return (
                <PlayerChip
                  key={id}
                  avatar={p.avatar}
                  nickname={p.nickname}
                  out={isOut}
                  status={
                    isOut
                      ? "已出局 💀"
                      : state.phase === "day_voting"
                        ? hasVoted
                          ? "已投票 ✓"
                          : "思考中…"
                        : "存活 🛡️"
                  }
                />
              );
            })}
          </ul>
        )}

        <HostGameControls />
      </div>
    </HostShell>
  );
}
