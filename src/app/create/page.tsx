import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Crown, Dices } from "lucide-react";
import { GAMES } from "@/constants/games";
import { PLAY_MODES } from "@/constants/playModes";
import { isPlayable } from "@/engine";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "建立房間 — 選擇遊戲",
  description: "選擇一款派對遊戲，建立房間邀請朋友加入。",
  robots: { index: false, follow: false },
};

export default function CreateSelectorPage() {
  const playableGames = GAMES.filter((g) => isPlayable(g.id));

  return (
    <main className="min-h-screen bg-ink px-4 pb-20 pt-28 text-white">
      <Navbar />
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white/70"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> 返回首頁
        </Link>

        <header className="mb-10 text-center">
          <p className="glass mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-violet-400">
            <Crown className="h-4 w-4" aria-hidden="true" />
            建立遊戲房間
          </p>
          <h1 className="mb-2 text-3xl font-bold md:text-4xl">選擇你想主持的遊戲</h1>
          <p className="text-sm text-white/40">選定遊戲後即可設定人數與規則，獲得專屬房間代碼與 QR Code</p>
        </header>

        {/* Random party modes: pick a time box or an 8-game championship. */}
        <section className="mb-10" aria-labelledby="random-heading">
          <div className="mb-4">
            <h2 id="random-heading" className="flex items-center gap-2 text-lg font-bold text-white">
              <Dices className="h-5 w-5 text-cyan-300" aria-hidden="true" />
              隨機派對模式
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              不想挑遊戲？選時間盒，或挑戰 8 款不同遊戲的決戰模式；系統會依人數隨機抽出遊戲清單。
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PLAY_MODES.map((mode) => (
              <Link
                key={mode.id}
                href={`/random?mode=${mode.id}`}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 transition-all hover:-translate-y-1 hover:border-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span
                  className="pointer-events-none absolute inset-x-0 -top-16 h-24 opacity-25 blur-2xl"
                  style={{ background: mode.gradient }}
                  aria-hidden="true"
                />
                <span className="relative block text-2xl" aria-hidden="true">
                  {mode.icon}
                </span>
                <span className="relative mt-2 block text-base font-bold text-white">{mode.label}</span>
                <span className="relative mt-1 block text-xs leading-relaxed text-white/50">{mode.tagline}</span>
                <span
                  className="relative mt-3 inline-block text-xs font-bold"
                  style={{ color: mode.color }}
                >
                  開始抽選 →
                </span>
              </Link>
            ))}
          </div>
        </section>

        <h2 className="mb-4 text-lg font-bold text-white">或者自己挑一款</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playableGames.map((game) => (
            <Link
              key={game.id}
              href={`/create/${game.id}`}
              className="glass-card group flex flex-col justify-between rounded-2xl p-6 transition-all hover:-translate-y-1 hover:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                    style={{ background: `${game.color}20`, border: `1px solid ${game.color}30` }}
                    aria-hidden="true"
                  >
                    {game.icon}
                  </span>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                    可開房
                  </span>
                </div>
                <h2 className="mb-1 text-lg font-bold text-white group-hover:text-violet-300 transition-colors">
                  {game.name}
                </h2>
                <p lang="en" className="mb-2 text-xs text-white/40">
                  {game.nameEn}
                </p>
                <p className="text-xs leading-relaxed text-white/60 line-clamp-2">
                  {game.description}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between pt-4 border-t border-white/5 text-xs text-white/40">
                <span>{game.minPlayers}–{game.maxPlayers} 人</span>
                <span className="font-medium text-violet-400 group-hover:translate-x-1 transition-transform">
                  建立此遊戲 →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
