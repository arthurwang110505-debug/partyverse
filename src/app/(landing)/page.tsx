"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Zap } from "lucide-react";
import { GAMES } from "@/constants/games";
import GameCard from "@/components/GameCard";
import Navbar from "@/components/Navbar";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const featuredGames = [GAMES[0], GAMES[1], GAMES[3], GAMES[4]];

  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-x-hidden">
      <Navbar />

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/15 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-600/5 rounded-full blur-[120px]" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        </div>

        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-sm text-white/60 mb-8">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>Multiplayer party platform</span>
          </div>

          <h1 className="font-bold text-7xl md:text-8xl lg:text-9xl mb-6 leading-[0.9] tracking-tight">
            <span className="block text-white">PARTY</span>
            <span className="block bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">VERSE</span>
          </h1>

          <p className="text-lg md:text-xl text-white/50 mb-10 max-w-xl mx-auto leading-relaxed">
            Join the ultimate party gaming experience. One room, ten games, endless fun with friends.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link href="/games" prefetch>
              <button className="group px-8 py-4 rounded-2xl bg-white text-black font-semibold text-base hover:bg-white/90 transition-all flex items-center gap-2">
                Browse Games
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </Link>
            <Link href="/join" prefetch>
              <button className="px-8 py-4 rounded-2xl glass font-semibold text-base text-white/80 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2">
                <Zap className="w-4 h-4 text-violet-400" />
                Join a Party
              </button>
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-8 md:gap-12 mt-16">
            {[
              { value: "10", label: "Games" },
              { value: "4-20", label: "Players" },
              { value: "3-20", label: "Minutes" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-bold text-2xl text-white mb-0.5">{stat.value}</div>
                <div className="text-white/40 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="w-5 h-8 rounded-full border-2 border-white/20 flex items-start justify-center p-1.5">
            <div className="w-1 h-2 bg-white/40 rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* FEATURED GAMES */}
      <section className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="font-bold text-3xl md:text-4xl mb-2">
                Featured Games
              </h2>
              <p className="text-white/40 text-base">Hand-picked favorites for your next party</p>
            </div>
            <Link href="/games" prefetch className="hidden md:flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredGames.map((game, i) => (
              <div key={game.id}>
                <GameCard game={game} compact />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ALL GAMES */}
      <section className="py-24 px-4 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-bold text-3xl md:text-4xl mb-3">All Games</h2>
            <p className="text-white/40 text-base max-w-md mx-auto">
              Ten unique games designed for groups. From quick icebreakers to intense competitive matches.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {GAMES.map((game) => (
              <div key={game.id}>
                <GameCard game={game} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 px-4 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <p className="font-bold text-base mb-1">PARTYVERSE</p>
            <p className="text-white/30 text-sm">One Room. Ten Games. Infinite Chaos.</p>
          </div>
          <p className="text-white/20 text-xs">© 2025 PartyVerse. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
