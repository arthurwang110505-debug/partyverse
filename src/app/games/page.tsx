"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import { GAMES } from "@/constants/games";
import GameCard from "@/components/GameCard";
import { CATEGORIES, type Category } from "@/types";
import { isPlayable } from "@/engine";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

export default function GamesPage() {
  const [filter, setFilter] = useState<Category | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [showPlayableOnly, setShowPlayableOnly] = useState(false);
  const debouncedSearch = useDebounce(search, 150);

  const filtered = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    return GAMES.filter((g) => {
      if (filter !== "ALL" && g.category !== filter) return false;
      if (showPlayableOnly && !isPlayable(g.id)) return false;
      if (!needle) return true;
      return (
        g.name.toLowerCase().includes(needle) ||
        g.nameEn.toLowerCase().includes(needle) ||
        g.tags.some((t) => t.toLowerCase().includes(needle))
      );
    });
  }, [filter, debouncedSearch, showPlayableOnly]);

  return (
    <div className="min-h-screen bg-ink text-white">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-32">
        <header className="mb-10">
          <h1 className="mb-3 text-4xl font-bold md:text-5xl">全部遊戲</h1>
          <p className="text-base text-white/40">挑一款遊戲，和朋友開房同樂</p>
        </header>

        <div className="mb-8 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" aria-hidden="true" />
            <label htmlFor="game-search" className="sr-only">
              搜尋遊戲
            </label>
            <input
              id="game-search"
              type="search"
              placeholder="搜尋遊戲名稱或標籤…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowPlayableOnly((v) => !v)}
            aria-pressed={showPlayableOnly}
            className={cn(
              "whitespace-nowrap rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
              showPlayableOnly
                ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
            )}
          >
            只看可玩
          </button>
        </div>

        <div
          className="mb-8 flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="依分類篩選"
        >
          {(["ALL", ...Object.values(CATEGORIES)] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              aria-pressed={filter === cat}
              className={cn(
                "whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
                filter === cat
                  ? "bg-white text-black"
                  : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
              )}
            >
              {cat === "ALL" ? "全部" : cat}
            </button>
          ))}
        </div>

        <p className="mb-6 text-sm text-white/40" role="status" aria-live="polite">
          共 {filtered.length} 款遊戲
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${filter}-${debouncedSearch}-${showPlayableOnly}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {filtered.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </motion.div>
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="py-24 text-center">
            <p className="mb-4 text-4xl" aria-hidden="true">
              🔍
            </p>
            <p className="text-lg text-white/40">找不到遊戲</p>
            <p className="mt-1 text-sm text-white/25">換個關鍵字或分類試試</p>
          </div>
        )}
      </div>
    </div>
  );
}
