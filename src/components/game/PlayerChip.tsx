import { cn } from "@/lib/utils";

interface PlayerChipProps {
  avatar: string;
  nickname: string;
  score?: number;
  /** Currently-active player (bomb holder, drawer…) — highlighted in game accent. */
  highlight?: boolean;
  /** Eliminated / offline presentation. */
  out?: boolean;
  /** Small status line under the name, e.g. "已投票 ✅" / "出局". */
  status?: string;
}

/**
 * The avatar-name-score tile used by every TV scoreboard. Previously each host
 * view re-implemented it (7 copies and counting), which is how the bomb board
 * ended up violet-accented in a red-accented game.
 */
export function PlayerChip({ avatar, nickname, score, highlight, out, status }: PlayerChipProps) {
  return (
    <li
      className={cn(
        "rounded-xl border p-3 text-center transition-all",
        out
          ? "border-red-500/20 bg-red-500/10 opacity-50"
          : highlight
            ? "border-[color:var(--game-accent,#a855f7)]/60 bg-[color:var(--game-accent,#a855f7)]/15"
            : "border-white/5 bg-white/5",
      )}
    >
      <p className="mb-1 text-2xl" aria-hidden="true">
        {out ? "💀" : avatar}
      </p>
      <p className="truncate text-sm font-medium">{nickname}</p>
      {typeof score === "number" && !out && (
        <p className="text-xs tabular-nums text-white/40">{score} 分</p>
      )}
      {(status || out) && <p className={cn("text-xs", out ? "text-red-400" : "text-white/50")}>{status ?? "出局"}</p>}
    </li>
  );
}
