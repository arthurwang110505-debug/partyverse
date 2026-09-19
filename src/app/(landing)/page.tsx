import Link from "next/link";
import { ArrowRight, Monitor, Smartphone, Zap } from "lucide-react";
import { GAMES } from "@/constants/games";
import { playableGameIds } from "@/engine";
import GameCard from "@/components/GameCard";
import Navbar from "@/components/Navbar";
import { LinkButton } from "@/components/ui/Button";

/**
 * A server component.
 *
 * This used to be `"use client"` with `if (!mounted) return null`, which meant
 * the entire homepage shipped as an empty `<body>`: 6,434 bytes of markup, zero
 * characters of visible text, no `<h1>`. Search engines and link previews saw
 * nothing. There is no state or effect here that needs the browser, so the gate
 * is simply gone.
 */
export default function Home() {
  const playableCount = playableGameIds().length;
  const featuredGames = GAMES.filter((g) => playableGameIds().includes(g.id))
    .concat(GAMES.filter((g) => !playableGameIds().includes(g.id)))
    .slice(0, 4);

  return (
    <div className="min-h-screen overflow-x-hidden bg-ink text-white">
      <Navbar />

      {/* HERO */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
        {/* Decorative only — hidden from assistive tech. */}
        <div className="absolute inset-0" aria-hidden="true">
          <div className="absolute left-1/4 top-0 h-[600px] w-[600px] rounded-full bg-violet-600/15 blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-pink-600/10 blur-[100px]" />
          <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-600/5 blur-[120px]" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
          <p className="glass mb-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-white/60">
            <Zap className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
            多人派對遊戲平台
          </p>

          <h1 className="mb-6 text-7xl font-bold leading-[0.9] tracking-tight md:text-8xl lg:text-9xl">
            <span className="block text-white" lang="en">
              PARTY
            </span>
            <span
              className="block bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent"
              lang="en"
            >
              VERSE
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-white/50 md:text-xl">
            一間房，十款遊戲。電視當主畫面，手機就是手把——掃 QR code 就能加入，和朋友一起混亂。
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <LinkButton href="/games" variant="primary" size="lg" prefetch>
              瀏覽遊戲
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </LinkButton>
            <LinkButton href="/join" variant="glass" size="lg" prefetch>
              <Zap className="h-4 w-4 text-violet-400" aria-hidden="true" />
              加入派對
            </LinkButton>
          </div>

          <div className="mt-16 flex flex-wrap justify-center gap-8 md:gap-12">
            {[
              { value: String(GAMES.length), label: "款遊戲" },
              { value: String(playableCount), label: "現已開放" },
              { value: "4–20", label: "位玩家" },
              { value: "3–20", label: "分鐘" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="mb-0.5 text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-white/40">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2" aria-hidden="true">
          <div className="flex h-8 w-5 items-start justify-center rounded-full border-2 border-white/20 p-1.5">
            <div className="h-2 w-1 animate-bounce rounded-full bg-white/40" />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-4 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-3 text-3xl font-bold md:text-4xl">怎麼玩？</h2>
          <p className="mb-12 max-w-md text-base text-white/40">不用下載 App，不用註冊。三分鐘開始。</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                icon: <Monitor className="h-5 w-5" aria-hidden="true" />,
                title: "1. 開一間房",
                body: "選一款遊戲、輸入暱稱，拿到一組五位數的房間代碼。",
              },
              {
                icon: <Smartphone className="h-5 w-5" aria-hidden="true" />,
                title: "2. 朋友掃 QR code",
                body: "把手機鏡頭對準電視上的 QR code，輸入名字就加入，免安裝。",
              },
              {
                icon: <Zap className="h-5 w-5" aria-hidden="true" />,
                title: "3. 房主按開始",
                body: "電視顯示場面，手機就是控制器。每一局的分數即時同步。",
              },
            ].map((step) => (
              <div key={step.title} className="glass-card rounded-2xl p-6">
                <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300">
                  {step.icon}
                </span>
                <h3 className="mb-2 text-base font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-white/50">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED GAMES */}
      <section className="px-4 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex items-end justify-between gap-4">
            <div>
              <h2 className="mb-2 text-3xl font-bold md:text-4xl">精選遊戲</h2>
              <p className="text-base text-white/40">為你的下一場派對挑幾款</p>
            </div>
            <Link
              href="/games"
              className="hidden items-center gap-1 text-sm text-white/50 transition-colors hover:text-white md:flex"
            >
              查看全部 <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredGames.map((game) => (
              <GameCard key={game.id} game={game} compact />
            ))}
          </div>
        </div>
      </section>

      {/* ALL GAMES */}
      <section className="bg-white/[0.02] px-4 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold md:text-4xl">全部遊戲</h2>
            <p className="mx-auto max-w-md text-base text-white/40">
              {GAMES.length} 款為團體設計的遊戲，從快速破冰到激烈對抗。目前已有 {playableCount} 款開放遊玩，其餘持續開發中。
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {GAMES.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 px-4 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="text-center md:text-left">
            <p className="mb-1 text-base font-bold" lang="en">
              PARTYVERSE
            </p>
            <p className="text-sm text-white/30">One Room. Ten Games. Infinite Chaos.</p>
          </div>
          <p className="text-xs text-white/30">© {new Date().getFullYear()} PartyVerse</p>
        </div>
      </footer>
    </div>
  );
}
