import Link from "next/link";
import { ArrowRight, Clock, Users } from "lucide-react";
import type { GameDefinition } from "@/types";
import { isPlayable } from "@/engine";
import { cn } from "@/lib/utils";

interface GameCardProps {
  game: GameDefinition;
  compact?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  PARTY: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  SOCIAL: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  CREATIVE: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  MYSTERY: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  MUSIC: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

/**
 * A server component: it has no state or effects, so marking it `"use client"`
 * only pulled it (and its imports) into the browser bundle for nothing.
 *
 * The whole card is one link. The call-to-action at the bottom is a styled
 * `<span>`, not a nested `<button>` — interactive-inside-interactive is invalid
 * HTML and gets announced twice by screen readers.
 */
export default function GameCard({ game, compact = false }: GameCardProps) {
  const playable = isPlayable(game.id);

  return (
    <Link
      href={`/games/${game.id}`}
      className="group block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
    >
      <article className="relative h-full rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-white/20">
        <div className="mb-4 flex items-start justify-between gap-2">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl"
            style={{ background: `${game.color}20`, border: `1px solid ${game.color}30` }}
            aria-hidden="true"
          >
            {game.icon}
          </span>
          <span className="flex flex-col items-end gap-1">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                CATEGORY_COLORS[game.category],
              )}
            >
              {game.category}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                playable ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/40",
              )}
            >
              {playable ? "可玩" : "即將推出"}
            </span>
          </span>
        </div>

        <h3 className="mb-0.5 text-lg font-bold text-white">
          <span lang="zh-Hant">{game.name}</span>
        </h3>
        <p lang="en" className="mb-3 text-xs text-white/40">
          {game.nameEn}
        </p>

        <p className={cn("mb-4 leading-relaxed text-white/60", compact ? "line-clamp-2 text-xs" : "line-clamp-2 text-sm")}>
          {game.description}
        </p>

        <div className="mb-4 flex items-center gap-3 text-xs text-white/40">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" aria-hidden="true" />
            {game.minPlayers}–{game.maxPlayers}人
          </span>
          <span aria-hidden="true" className="text-white/20">
            ·
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {game.estimatedDuration}
          </span>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {game.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/40">
              {tag}
            </span>
          ))}
        </div>

        <span
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all"
          style={{
            background: `${game.color}20`,
            border: `1px solid ${game.color}30`,
            color: game.color,
            opacity: playable ? 1 : 0.55,
          }}
        >
          {playable ? "查看詳情" : "搶先了解"}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </article>
    </Link>
  );
}
