import { Check, Clock, Repeat, Sparkles } from "lucide-react";
import type { RoomSessionPlan } from "@/types";
import { GAMES } from "@/constants/games";
import { playModeById } from "@/constants/playModes";
import { sessionProgress, settingsSummary } from "@/lib/playlist";
import { cn } from "@/lib/utils";

/**
 * The drawn playlist: what is being played, what is queued, and how far the
 * session has progressed. Read-only — every action lives on the screen it is placed on.
 */
export function SessionPlanPanel({
  plan,
  className,
  showSettings = false,
  highlightCurrent = true,
  currentCompleted = false,
}: {
  plan: RoomSessionPlan | null | undefined;
  className?: string;
  /** Show each entry's suggested settings (timer / rounds). */
  showSettings?: boolean;
  /** Mark the head of the queue as "now playing". */
  highlightCurrent?: boolean;
  /** Treat the current entry as finished while it awaits promotion to `played`. */
  currentCompleted?: boolean;
}) {
  const progress = sessionProgress(plan);
  if (!plan || !progress) return null;

  const preset = playModeById(plan.mode);
  const current = plan.entries[0];
  const repeats = plan.entries.filter((entry) => entry.repeated);
  const battleMode = Boolean(preset?.gameCount);
  const doneBeforeCurrent = progress.total ? progress.total - plan.entries.length : 0;
  const done = doneBeforeCurrent + (currentCompleted && current ? 1 : 0);
  const remainingMinutes = plan.entries.reduce((sum, entry) => sum + entry.minutes, 0);

  return (
    <section
      className={cn("rounded-2xl border border-white/10 bg-white/5 p-4", className)}
      aria-label={battleMode ? "決戰模式進度" : "隨機時段進度"}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold text-white">
          <span aria-hidden="true">{preset?.icon ?? "🎲"}</span>
          {progress.label}
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/60">
            {progress.finished ? (battleMode ? "決戰結束" : "時段結束") : `第 ${progress.index} / ${progress.total} 款`}
          </span>
        </p>
        <p className="flex items-center gap-1 text-[11px] text-white/50 tabular-nums">
          {battleMode ? (
            <>
              <span aria-hidden="true">⚔️</span>
              已完成 {done} / {progress.total} 款
            </>
          ) : (
            <>
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {progress.finished
                ? `預估 ${done} 款完成`
                : `剩下 ${remainingMinutes} 分 / 上限 ${plan.budgetMinutes ?? 0} 分`}
            </>
          )}
        </p>
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-black/40" aria-hidden="true">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${progress.total ? Math.min(100, (done / progress.total) * 100) : 0}%`,
            background: preset?.gradient,
          }}
        />
      </div>

      <ol className="space-y-1.5">
        {plan.played.map((gameId) => {
          const game = GAMES.find((g) => g.id === gameId);
          return (
            <li key={`played-${gameId}`} className="flex items-center gap-2.5 rounded-xl bg-black/20 px-3 py-2 text-xs text-white/45">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
              <span aria-hidden="true">{game?.icon ?? "🎮"}</span>
              <span className="min-w-0 flex-1 truncate line-through">{game?.name ?? gameId}</span>
              <span className="shrink-0 text-[10px]">已玩</span>
            </li>
          );
        })}
        {plan.entries.map((entry, index) => {
          const game = GAMES.find((g) => g.id === entry.gameId);
          const currentFinished = currentCompleted && index === 0;
          const isCurrent = highlightCurrent && index === 0 && !currentFinished;
          return (
            <li
              key={`${entry.gameId}-${index}`}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs",
                currentFinished
                  ? "border border-emerald-400/20 bg-emerald-500/5 text-white/60"
                  : isCurrent
                    ? "border border-white/20 bg-white/10 text-white"
                    : "bg-black/20 text-white/60",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
                  currentFinished ? "bg-emerald-500/20 text-emerald-300" : isCurrent ? "bg-white text-black" : "bg-white/10 text-white/50",
                )}
              >
                {currentFinished ? <Check className="h-3 w-3" aria-hidden="true" /> : isCurrent ? "▶" : doneBeforeCurrent + index + 1}
              </span>
              <span aria-hidden="true" className="text-base">
                {game?.icon ?? "🎮"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className={cn("truncate font-semibold", isCurrent && "text-white", currentFinished && "line-through")}>
                    {game?.name ?? entry.gameId}
                  </span>
                  {entry.repeated && (
                    <span
                      className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300"
                      title="其他可玩的遊戲都玩過了，所以這款重複"
                    >
                      <Repeat className="h-2.5 w-2.5" aria-hidden="true" />
                      重複
                    </span>
                  )}
                </span>
                {showSettings && (
                  <span className="mt-0.5 block text-[10px] text-white/45">
                    建議設定 · {settingsSummary(entry.gameId, entry.settings)}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-white/45">
                {currentFinished ? "已完成" : `約 ${entry.minutes} 分`}
              </span>
            </li>
          );
        })}
        {!plan.entries.length && (
          <li className="flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-xs text-white/60">
            <Sparkles className="h-3.5 w-3.5 text-yellow-300" aria-hidden="true" />
            {battleMode ? "8 款遊戲都玩完了！決戰排名已揭曉。" : "這個時段的遊戲都玩完了！"}
          </li>
        )}
      </ol>

      {repeats.length > 0 && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-200/80">
          <Repeat className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          {repeats.map((entry) => GAMES.find((g) => g.id === entry.gameId)?.name ?? entry.gameId).join("、")}
          是近期玩過的遊戲；本清單內不會重複同一款。
        </p>
      )}

      {current && plan.entries.length > 1 && (
        <p className="mt-2.5 text-[11px] leading-relaxed text-white/40">
          下一款：{GAMES.find((g) => g.id === plan.entries[1].gameId)?.name ?? plan.entries[1].gameId} · 玩完這款就會自動接下一個。
        </p>
      )}
    </section>
  );
}
