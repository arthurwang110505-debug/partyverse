"use client";

import Link from "next/link";
import { Users, Clock, ArrowRight } from "lucide-react";
import type { GameDefinition } from "@/types";
import { cn } from "@/lib/utils";

interface GameCardProps {
  game: GameDefinition;
  compact?: boolean;
}

export default function GameCard({ game, compact = false }: GameCardProps) {
  const categoryColors: Record<string, string> = {
    PARTY: "bg-pink-500/20 text-pink-400 border-pink-500/30",
    SOCIAL: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    CREATIVE: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    MYSTERY: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    MUSIC: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };

  return (
    <Link href={`/games/${game.id}`} prefetch className="group block">
      <div className="relative h-full rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1">
        <div className="relative h-full bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm group-hover:border-white/20 transition-colors">
          {/* Icon and category */}
          <div className="flex items-start justify-between mb-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
              style={{ background: `${game.color}20`, border: `1px solid ${game.color}30` }}
            >
              {game.icon}
            </div>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border", categoryColors[game.category])}>
              {game.category}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-bold text-lg mb-0.5 text-white">
            {game.name}
          </h3>
          <p className="text-white/40 text-xs mb-3">{game.nameEn}</p>

          {/* Description */}
          <p className="text-white/60 text-sm mb-4 line-clamp-2 leading-relaxed">
            {game.description}
          </p>

          {/* Meta info */}
          <div className="flex items-center gap-3 text-white/40 text-xs mb-4">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {game.minPlayers}–{game.maxPlayers}人
            </span>
            <span className="text-white/20">·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {game.estimatedDuration}
            </span>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {game.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div
            className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
            style={{ background: `${game.color}20`, border: `1px solid ${game.color}30`, color: game.color }}
          >
            Play <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  );
}
