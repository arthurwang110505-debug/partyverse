"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2 } from "lucide-react";
import { GAMES } from "@/constants/games";
import GameCard from "@/components/GameCard";
import { CATEGORIES, type Category } from "@/types";
import { cn } from "@/lib/utils";

export default function GamesPage() {
  const [filter, setFilter] = useState<Category | "ALL">("ALL");
  const [search, setSearch] = useState("");

  const filtered = GAMES.filter((g) => {
    const matchCategory = filter === "ALL" || g.category === filter;
    const matchSearch = g.name.includes(search) || g.nameEn.toLowerCase().includes(search.toLowerCase()) || g.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchCategory && matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <div className="max-w-7xl mx-auto px-4 py-24">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="font-bold text-4xl md:text-5xl mb-3">All Games</h1>
          <p className="text-white/40 text-base">Choose a game and start playing with your friends</p>
        </motion.div>

        {/* Search and filters */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Gamepad2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search games..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setFilter("ALL")} className={cn("px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all", filter === "ALL" ? "bg-white text-black" : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10")}>
              All
            </button>
            {Object.values(CATEGORIES).map((cat) => (
              <button key={cat} onClick={() => setFilter(cat)} className={cn("px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all", filter === cat ? "bg-white text-black" : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10")}>
                {cat}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Results count */}
        <p className="text-white/30 text-sm mb-6">{filtered.length} game{filtered.length !== 1 ? "s" : ""}</p>

        {/* Games grid */}
        <AnimatePresence mode="wait">
          <motion.div key={filter + search} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((game, i) => (
              <motion.div key={game.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.3 }}>
                <GameCard game={game} />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-24">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-white/40 text-lg">No games found</p>
            <p className="text-white/20 text-sm mt-1">Try a different search or filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
