import Link from "next/link";
import { ArrowRight, Monitor, QrCode, Radio, Smartphone, Sparkles, Terminal, Users, Zap } from "lucide-react";
import { GAMES } from "@/constants/games";
import { playableGameIds } from "@/engine";
import GameCard from "@/components/GameCard";
import Navbar from "@/components/Navbar";

/** Retro LED Dot Matrix Cluster Component */
function LedMatrixBlock({
  color = "cyan",
  rows = 4,
  cols = 8,
  className = "",
}: {
  color?: "cyan" | "pink";
  rows?: number;
  cols?: number;
  className?: string;
}) {
  const isCyan = color === "cyan";
  return (
    <div
      className={`grid gap-1 p-1 select-none pointer-events-none ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      aria-hidden="true"
    >
      {Array.from({ length: rows * cols }).map((_, i) => {
        // Pseudo-random lighted pattern
        const active = (i * 13 + 7) % 7 > 1;
        const bright = (i * 5 + 3) % 4 === 0;
        return (
          <div
            key={i}
            className={`h-1.5 w-1.5 rounded-sm transition-all duration-300 ${
              active
                ? isCyan
                  ? bright
                    ? "bg-white shadow-[0_0_8px_#00f0ff]"
                    : "bg-cyan-400/80 shadow-[0_0_4px_#00f0ff]"
                  : bright
                    ? "bg-white shadow-[0_0_8px_#ff007f]"
                    : "bg-pink-500/80 shadow-[0_0_4px_#ff007f]"
                : "bg-white/5"
            }`}
          />
        );
      })}
    </div>
  );
}

export default function Home() {
  const playableCount = playableGameIds().length;
  const featuredGames = GAMES.filter((g) => playableGameIds().includes(g.id))
    .concat(GAMES.filter((g) => !playableGameIds().includes(g.id)))
    .slice(0, 4);

  return (
    <div className="landing-page relative min-h-[100svh] bg-[#030612] text-white selection:bg-[#ff007f] selection:text-white">
      <Navbar />

      {/* CRT SCANLINES & SCANNING LASER BEAM OVERLAY */}
      <div
        className="landing-decoration pointer-events-none fixed inset-0 z-40 hidden scanlines opacity-20 md:block"
        aria-hidden="true"
      />
      <div
        className="landing-decoration pointer-events-none fixed inset-x-0 hidden md:block h-2 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent blur-sm z-40 animate-scan-beam"
        aria-hidden="true"
      />

      {/* HERO SECTION — CYBERPUNK / NEON GLITCH ART */}
      <section className="relative flex min-h-[100svh] items-center justify-center overflow-clip pb-12 pt-28 sm:pb-20">
        {/* Static gradients keep the neon atmosphere without large GPU blur surfaces. */}
        <div className="landing-ambient pointer-events-none absolute inset-0" aria-hidden="true" />

        <div className="relative z-10 mx-auto w-full min-w-0 max-w-5xl px-4 text-center">
          {/* Top Cyber System Status & Corner LED Blocks */}
          <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
            <LedMatrixBlock color="cyan" rows={3} cols={6} className="hidden sm:grid" />

            <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-black/60 px-3 py-2 text-[10px] sm:text-xs font-mono tracking-wide text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.25)] backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
              <Terminal className="h-3.5 w-3.5 text-cyan-400" />
              <span>{"//"} READY TO PARTY</span>
              <span className="hidden text-pink-400 sm:inline">TV + PHONE</span>
            </div>

            <LedMatrixBlock color="pink" rows={3} cols={6} className="hidden sm:grid" />
          </div>

          {/* Subtitle Cyber Badge */}
          <div className="mb-6 inline-flex flex-wrap items-center justify-center gap-2 font-mono text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/60 bg-cyan-950/60 px-3 py-1 font-bold text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.3)]">
              <Monitor className="h-3.5 w-3.5 text-cyan-400" />[ 01_HOST: 客廳大螢幕 ]
            </span>
            <span className="text-pink-500 font-black animate-pulse">⚡ CROSS-LINK ⚡</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#ff007f]/60 bg-pink-950/60 px-3 py-1 font-bold text-pink-300 shadow-[0_0_15px_rgba(255,0,127,0.3)]">
              <Smartphone className="h-3.5 w-3.5 text-pink-400" />[ 02_NODE: 手機虛擬手把 ]
            </span>
          </div>

          {/* MASSIVE GLITCH NEON TITLE */}
          <div className="relative my-4 select-none">
            {/* Foreground Main Pure White Core + Neon Halos */}
            <h1 className="relative text-[clamp(3.75rem,18vw,8rem)] font-black leading-[0.9] tracking-tight">
              <span className="block neon-text-cyan" lang="en">
                PARTY
              </span>
              <span className="block neon-text-pink" lang="en">
                VERSE
              </span>
            </h1>
          </div>

          {/* Cyberpunk Terminal Description */}
          <p className="mx-auto mt-6 mb-10 max-w-2xl font-mono text-sm leading-relaxed text-cyan-100/70 sm:text-base md:text-lg">
            一間房，十款遊戲。電視就是舞台，手機就是手把。
            <br />
            免下載、免註冊，揪朋友一起開趴！
          </p>

          {/* CYBERPUNK NEON CALL-TO-ACTION BUTTONS */}
          <div className="mx-auto flex w-full max-w-lg flex-col items-stretch justify-center gap-3 sm:flex-row">
            {/* Cyan Cyber Button */}
            <Link
              href="/games"
              className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-cyan-400 bg-cyan-950/70 px-4 py-4 font-mono font-black sm:px-8 text-white shadow-[0_0_25px_rgba(0,240,255,0.4),inset_0_0_15px_rgba(0,240,255,0.2)] transition-all duration-200 hover:scale-105 hover:bg-cyan-500 hover:text-black hover:shadow-[0_0_40px_rgba(0,240,255,0.8)] active:scale-95 sm:w-auto"
            >
              {/* Corner tech notches */}
              <span className="absolute top-0 left-0 h-2 w-2 border-t-2 border-l-2 border-white" />
              <span className="absolute bottom-0 right-0 h-2 w-2 border-b-2 border-r-2 border-white" />

              <Monitor className="h-5 w-5 text-cyan-300 group-hover:text-black transition-colors" />
              <span className="tracking-wider">挑選遊戲開房</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>

            {/* Neon Pink Cyber Button */}
            <Link
              href="/join"
              className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-[#ff007f] bg-pink-950/70 px-4 py-4 font-mono font-black sm:px-8 text-white shadow-[0_0_25px_rgba(255,0,127,0.4),inset_0_0_15px_rgba(255,0,127,0.2)] transition-all duration-200 hover:scale-105 hover:bg-[#ff007f] hover:text-white hover:shadow-[0_0_40px_rgba(255,0,127,0.8)] active:scale-95 sm:w-auto"
            >
              {/* Corner tech notches */}
              <span className="absolute top-0 left-0 h-2 w-2 border-t-2 border-l-2 border-white" />
              <span className="absolute bottom-0 right-0 h-2 w-2 border-b-2 border-r-2 border-white" />

              <Smartphone className="h-5 w-5 text-pink-300 group-hover:text-white transition-colors" />
              <span className="tracking-wider">加入房間</span>
              <Zap className="h-4 w-4 text-yellow-300 transition-transform group-hover:rotate-12" />
            </Link>
          </div>

          {/* DUAL TERMINAL HARDWARE SHOWCASE WITH LED MATRICES */}
          <div className="relative mx-auto mt-10 w-full min-w-0 max-w-4xl rounded-3xl border-2 border-cyan-500/30 bg-[#060a1c]/80 p-3 sm:p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:p-8">
            {/* Tech Header bar */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 text-[10px] sm:text-xs font-mono text-white/50">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-cyan-300 font-bold">TV + PHONE // 操作示意</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-pink-400">非實際遊戲房間</span>
                <span className="hidden sm:inline"></span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              {/* Left: TV Display Console (Electric Cyan Neon) */}
              <div className="relative w-full min-w-0 flex-1 rounded-2xl border-2 border-cyan-400/60 bg-gradient-to-b from-[#071328] to-[#040817] p-3 sm:p-5 text-left shadow-[0_0_25px_rgba(0,240,255,0.15)] overflow-hidden">
                <LedMatrixBlock color="cyan" rows={2} cols={8} className="absolute top-2 right-2 opacity-50" />

                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/30 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
                    <span className="font-mono text-xs font-black uppercase tracking-wider text-cyan-300">
                      📺 電視主畫面
                    </span>
                  </div>
                  <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-200 border border-cyan-500/30">
                    CODE: 88421
                  </span>
                </div>

                <div className="space-y-3 font-mono">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-white">💣 炸彈倒數 · 核心警報</p>
                    <span className="rounded bg-[#ff007f]/20 px-2 py-0.5 text-xs font-black text-pink-400 border border-[#ff007f]/40 animate-pulse">
                      04 SEC
                    </span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-black/60 border border-cyan-500/30">
                    <div className="h-full w-4/5 bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_10px_#00f0ff]" />
                  </div>

                  <div className="flex items-center justify-between text-xs text-cyan-200/60 pt-1">
                    <span className="flex items-center gap-1.5 font-bold text-cyan-300">
                      <Users className="h-3.5 w-3.5" /> 6 節點在線
                    </span>
                    <span className="text-[10px] text-pink-400 font-bold">● LIVE SCORE SYNC</span>
                  </div>
                </div>
              </div>

              {/* Center: Cyber Data Link Channel */}
              <div className="flex flex-col items-center justify-center gap-1.5 shrink-0 px-2">
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-black text-cyan-300 bg-cyan-950/70 border border-cyan-400/50 px-3 py-1 rounded-full shadow-[0_0_12px_rgba(0,240,255,0.3)]">
                  <Radio className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                  <span>即時同步</span>
                </div>
                <div className="h-8 w-px bg-gradient-to-b from-cyan-400 via-white to-[#ff007f] md:h-px md:w-16 shadow-[0_0_6px_#ffffff]" />
                <span className="font-mono text-[9px] font-bold text-white/50">同一間房，一起玩</span>
              </div>

              {/* Right: Phone Gamepad Terminal (Neon Hot Pink) */}
              <div className="relative w-full min-w-0 flex-1 rounded-2xl border-2 border-[#ff007f]/60 bg-gradient-to-b from-[#1c0817] to-[#0a0410] p-3 sm:p-5 text-left shadow-[0_0_25px_rgba(255,0,127,0.15)] overflow-hidden">
                <LedMatrixBlock color="pink" rows={2} cols={8} className="absolute top-2 right-2 opacity-50" />

                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#ff007f]/30 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff007f] shadow-[0_0_8px_#ff007f]" />
                    <span className="font-mono text-xs font-black uppercase tracking-wider text-pink-300">
                      📱 手機控制器
                    </span>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-pink-200">玩家 👾</span>
                </div>

                <div className="space-y-3 font-mono">
                  <div className="flex justify-center gap-2.5 py-1">
                    <span
                      aria-hidden="true"
                      className="flex-1 rounded-xl border border-[#ff007f] bg-gradient-to-r from-pink-600 to-rose-600 py-2.5 text-center text-xs font-black text-white shadow-[0_0_15px_rgba(255,0,127,0.4)] active:scale-95 cursor-default"
                    >
                      剪紅線 ✂️
                    </span>
                    <span
                      aria-hidden="true"
                      className="flex-1 rounded-xl border border-cyan-400 bg-gradient-to-r from-cyan-600 to-blue-600 py-2.5 text-center text-xs font-black text-white shadow-[0_0_15px_rgba(0,240,255,0.4)] active:scale-95 cursor-default"
                    >
                      剪藍線 ⚡
                    </span>
                  </div>
                  <p className="text-center text-[10px] text-pink-200/70">示意畫面 · 請先開房或加入房間</p>
                </div>
              </div>
            </div>
          </div>

          {/* CYBER STATS DASHBOARD */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-6 font-mono">
            {[
              {
                value: `${GAMES.length} 款`,
                label: "精選派對遊戲",
                accent: "text-cyan-300",
                glow: "shadow-cyan-500/20",
              },
              {
                value: `${playableCount} 款`,
                label: "現已全數開放",
                accent: "text-emerald-300",
                glow: "shadow-emerald-500/20",
              },
              { value: "3–20 人", label: "支援同房同樂", accent: "text-pink-300", glow: "shadow-pink-500/20" },
              { value: "免下載", label: "免安裝掃碼秒玩", accent: "text-yellow-300", glow: "shadow-yellow-500/20" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="relative min-w-0 rounded-2xl border border-white/10 bg-black/40 p-4 text-center backdrop-blur-md transition-all hover:border-cyan-400/50 hover:bg-cyan-950/20 shadow-lg"
              >
                <p className={`text-xl font-black md:text-2xl ${stat.accent} drop-shadow-[0_0_10px_currentColor]`}>
                  {stat.value}
                </p>
                <p className="mt-1 text-xs font-semibold text-white/50">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SYSTEM PROTOCOL WORKFLOW (怎麼玩？) */}
      <section className="relative px-4 py-14 sm:py-24 border-t border-cyan-500/20 bg-[#040818]/60">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <span className="font-mono inline-block rounded-full border border-cyan-400/40 bg-cyan-950/40 px-4 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300 mb-3 shadow-[0_0_10px_rgba(0,240,255,0.2)]">
              {"//"} WORKFLOW_GUIDE
            </span>
            <h2 className="text-3xl font-black md:text-5xl tracking-tight text-white">三步驟，啟動派對核心！</h2>
            <p className="mx-auto mt-3 max-w-md font-mono text-sm text-cyan-100/60">
              免下載、免帳號註冊，以大螢幕為中樞，手機即終端手把。
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {/* Step 1: Cyan Tube */}
            <div className="relative rounded-3xl border-2 border-cyan-400/40 bg-gradient-to-b from-[#06142a] to-[#040816] p-8 shadow-[0_0_20px_rgba(0,240,255,0.15)] transition-all hover:-translate-y-1 hover:border-cyan-400">
              <LedMatrixBlock color="cyan" rows={2} cols={5} className="absolute top-4 right-4 opacity-40" />
              <span className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-300 ring-2 ring-cyan-400/40 shadow-[0_0_15px_#00f0ff]">
                <Monitor className="h-6 w-6" />
              </span>
              <span className="font-mono mb-1 block text-xs font-black uppercase tracking-wider text-cyan-400">
                STAGE_01 // HOST
              </span>
              <h3 className="mb-3 text-xl font-black text-white">開一間電視房</h3>
              <p className="font-mono text-sm leading-relaxed text-white/60">
                在客廳電視或電腦大螢幕挑選遊戲，一鍵生成專屬五位數房間代碼與高解析 QR Code。
              </p>
            </div>

            {/* Step 2: Purple Nexus */}
            <div className="relative rounded-3xl border-2 border-purple-500/40 bg-gradient-to-b from-[#190a2a] to-[#070416] p-8 shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-all hover:-translate-y-1 hover:border-purple-400">
              <LedMatrixBlock color="pink" rows={2} cols={5} className="absolute top-4 right-4 opacity-40" />
              <span className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-300 ring-2 ring-purple-400/40 shadow-[0_0_15px_#c084fc]">
                <QrCode className="h-6 w-6" />
              </span>
              <span className="font-mono mb-1 block text-xs font-black uppercase tracking-wider text-purple-400">
                STAGE_02 // SYNC
              </span>
              <h3 className="mb-3 text-xl font-black text-white">朋友掃碼秒速加入</h3>
              <p className="font-mono text-sm leading-relaxed text-white/60">
                所有人拿起手機鏡頭掃描電視畫面，輸入暱稱即時連入同一個派對房間，免安裝 App。
              </p>
            </div>

            {/* Step 3: Neon Hot Pink Tube */}
            <div className="relative rounded-3xl border-2 border-[#ff007f]/40 bg-gradient-to-b from-[#25081b] to-[#0a0412] p-8 shadow-[0_0_20px_rgba(255,0,127,0.15)] transition-all hover:-translate-y-1 hover:border-[#ff007f]">
              <LedMatrixBlock color="pink" rows={2} cols={5} className="absolute top-4 right-4 opacity-40" />
              <span className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff007f]/20 text-pink-300 ring-2 ring-[#ff007f]/40 shadow-[0_0_15px_#ff007f]">
                <Zap className="h-6 w-6" />
              </span>
              <span className="font-mono mb-1 block text-xs font-black uppercase tracking-wider text-pink-400">
                STAGE_03 // BATTLE
              </span>
              <h3 className="mb-3 text-xl font-black text-white">手機化身手把開戰</h3>
              <p className="font-mono text-sm leading-relaxed text-white/60">
                大螢幕同步遊戲舞台動畫與音效，手機自動載入按鈕手把、調色盤或投票控制器！
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED GAMES CATALOG */}
      <section className="px-4 py-20 bg-black/40 border-t border-white/5">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div>
              <span className="font-mono inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">
                <Sparkles className="h-3.5 w-3.5" /> {"//"} FEATURED_MODULES
              </span>
              <h2 className="text-3xl font-black md:text-5xl text-white">熱門派對模組</h2>
            </div>
            <Link
              href="/games"
              className="font-mono inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-950/30 px-5 py-2.5 text-sm font-bold text-cyan-200 transition-all hover:bg-cyan-900/40 hover:border-cyan-400"
            >
              檢視全部 {GAMES.length} 款遊戲 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredGames.map((game) => (
              <GameCard key={game.id} game={game} compact />
            ))}
          </div>
        </div>
      </section>

      {/* BROWSE BY CATEGORY */}
      <section className="px-4 py-24 border-t border-pink-500/20 bg-[#060614]">
        <div className="mx-auto max-w-7xl text-center">
          <div className="mb-12">
            <span className="font-mono inline-block rounded-full border border-pink-500/40 bg-pink-950/40 px-4 py-1 text-xs font-bold uppercase tracking-wider text-pink-300 mb-3">
              {"//"} MOOD_SELECTOR
            </span>
            <h2 className="text-3xl font-black md:text-5xl text-white">挑選今晚的派對氛圍</h2>
            <p className="mx-auto mt-3 max-w-md font-mono text-sm text-white/50">
              破冰、心機、手速狂點、合力解謎，一指切換全場節奏。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {(
              [
                {
                  category: "PARTY",
                  label: "派對破冰",
                  icon: "🎉",
                  desc: "簡單嗨翻",
                  border: "hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(0,240,255,0.3)]",
                },
                {
                  category: "SOCIAL",
                  label: "社交互動",
                  icon: "🧠",
                  desc: "心機推論",
                  border: "hover:border-purple-400 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]",
                },
                {
                  category: "CREATIVE",
                  label: "創意發揮",
                  icon: "🎨",
                  desc: "畫圖塗鴉",
                  border: "hover:border-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]",
                },
                {
                  category: "MYSTERY",
                  label: "推理懸疑",
                  icon: "🕵️",
                  desc: "臥底解謎",
                  border: "hover:border-[#ff007f] hover:shadow-[0_0_20px_rgba(255,0,127,0.3)]",
                },
                {
                  category: "MUSIC",
                  label: "音樂節奏",
                  icon: "🎵",
                  desc: "秒數聽歌",
                  border: "hover:border-yellow-400 hover:shadow-[0_0_20px_rgba(234,179,8,0.3)]",
                },
              ] as const
            ).map((entry) => {
              const count = GAMES.filter((g) => g.category === entry.category).length;
              return (
                <Link
                  key={entry.category}
                  href="/games"
                  className={`group rounded-3xl border border-white/10 bg-black/40 p-6 text-center transition-all hover:-translate-y-1.5 hover:bg-black/60 ${entry.border}`}
                >
                  <p className="mb-3 text-4xl transition-transform group-hover:scale-110" aria-hidden="true">
                    {entry.icon}
                  </p>
                  <p className="mb-1 text-base font-black text-white">{entry.label}</p>
                  <p className="text-xs text-white/40 mb-2 font-mono">{entry.desc}</p>
                  <span className="inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-mono font-bold text-white/70">
                    {count} 款
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Bottom Cyber Banner */}
          <div className="relative mt-16 rounded-3xl border-2 border-cyan-400/40 bg-gradient-to-r from-[#071730]/80 via-[#1e0724]/80 to-[#220718]/80 p-8 sm:p-12 text-center shadow-[0_0_40px_rgba(0,0,0,0.8)] overflow-hidden">
            <LedMatrixBlock
              color="cyan"
              rows={3}
              cols={12}
              className="absolute -top-1 -left-2 opacity-30 hidden sm:grid"
            />
            <LedMatrixBlock
              color="pink"
              rows={3}
              cols={12}
              className="absolute -bottom-1 -right-2 opacity-30 hidden sm:grid"
            />

            <span className="text-4xl mb-3 inline-block">🚀</span>
            <h3 className="text-2xl sm:text-4xl font-black text-white mb-3 tracking-wide">
              READY TO IGNITE THE PARTY?
            </h3>
            <p className="font-mono text-cyan-200/70 max-w-xl mx-auto mb-8 text-sm sm:text-base">
              現在就打開客廳電視開啟房間，邀請身旁的親朋好友一起同樂對決！
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 font-mono">
              <Link
                href="/games"
                className="rounded-xl border-2 border-cyan-400 bg-cyan-500 px-8 py-4 font-black text-black shadow-[0_0_25px_rgba(0,240,255,0.6)] hover:brightness-110 active:scale-95 transition-all"
              >
                [ 挑選遊戲開房 ]
              </Link>
              <Link
                href="/join"
                className="rounded-xl border-2 border-[#ff007f] bg-pink-950/60 px-8 py-4 font-black text-pink-300 shadow-[0_0_20px_rgba(255,0,127,0.4)] hover:bg-[#ff007f] hover:text-white active:scale-95 transition-all"
              >
                [ 加入現有房間 ]
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-cyan-500/20 px-4 py-12 bg-[#02040c]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="text-center md:text-left">
            <p className="mb-1 text-lg font-black tracking-wider font-mono" lang="en">
              <span className="text-cyan-400 drop-shadow-[0_0_8px_#00f0ff]">PARTY</span>
              <span className="text-[#ff007f] drop-shadow-[0_0_8px_#ff007f]">VERSE</span>
            </p>
            <p className="text-xs font-mono text-white/50">One Room. Ten Games. Infinite Cyber Chaos.</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-white/40">
            <span>SYS_VERSION: 2.1.0</span>
            <span>•</span>
            <span>© {new Date().getFullYear()} PartyVerse Cyberpunk Edition</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
