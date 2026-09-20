import Link from "next/link";
import { ArrowRight, Monitor, QrCode, Smartphone, Sparkles, Users, Zap } from "lucide-react";
import { GAMES } from "@/constants/games";
import { playableGameIds } from "@/engine";
import GameCard from "@/components/GameCard";
import Navbar from "@/components/Navbar";

export default function Home() {
  const playableCount = playableGameIds().length;
  const featuredGames = GAMES.filter((g) => playableGameIds().includes(g.id))
    .concat(GAMES.filter((g) => !playableGameIds().includes(g.id)))
    .slice(0, 4);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#090a10] text-white selection:bg-rose-500 selection:text-white">
      <Navbar />

      {/* HERO SECTION — HIGH CONTRAST BLUE & RED COLLISION */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-24 pb-16">
        {/* High-voltage Blue & Red Ambient Lighting */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {/* Left: Electric Blue / Cyan Glow */}
          <div className="absolute -left-20 top-1/4 h-[650px] w-[650px] rounded-full bg-cyan-500/20 blur-[140px]" />
          <div className="absolute left-1/4 -top-20 h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[160px]" />

          {/* Right: Burning Crimson / Neon Red Glow */}
          <div className="absolute -right-20 top-1/3 h-[650px] w-[650px] rounded-full bg-rose-500/20 blur-[140px]" />
          <div className="absolute right-1/4 bottom-10 h-[500px] w-[500px] rounded-full bg-red-600/20 blur-[160px]" />

          {/* Center Nexus */}
          <div className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/10 blur-[150px]" />

          {/* Futuristic Cyber Grid */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center">
          {/* Dual-Tone Contrasting Pills */}
          <div className="mb-6 inline-flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/50 bg-cyan-950/50 px-3.5 py-1 text-xs font-bold text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Monitor className="h-3.5 w-3.5 text-cyan-400" />
              電視當主畫面 · HOST
            </span>
            <span className="text-xs font-black text-white/40">VS</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/50 bg-rose-950/50 px-3.5 py-1 text-xs font-bold text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
              <Smartphone className="h-3.5 w-3.5 text-rose-400" />
              手機就是手把 · CONTROLLER
            </span>
          </div>

          {/* Striking Blue & Red Jump-Tone Typography */}
          <h1 className="mb-6 text-7xl font-black leading-[0.85] tracking-tight sm:text-8xl md:text-9xl">
            <span
              className="block bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(14,165,233,0.45)]"
              lang="en"
            >
              PARTY
            </span>
            <span
              className="block bg-gradient-to-r from-rose-400 via-red-500 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(244,63,94,0.45)]"
              lang="en"
            >
              VERSE
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg md:text-xl">
            一間房，十款遊戲。經典<span className="font-bold text-cyan-300"> 藍 </span>
            <span className="font-bold text-rose-400"> 紅 </span>
            撞色電玩派對！免下載 App、免註冊，朋友掃描電視上的 QR code 就能秒進房間，全場立刻嗨翻！
          </p>

          {/* High-Voltage Blue & Red Call-To-Action Buttons */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            {/* Blue Action — Host on TV */}
            <Link
              href="/games"
              className="group flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-cyan-400/40 bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 px-8 py-4 text-base font-black text-white shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all duration-200 hover:scale-105 hover:shadow-[0_0_45px_rgba(6,182,212,0.6)] active:scale-95 sm:w-auto"
            >
              <Monitor className="h-5 w-5 text-cyan-100 transition-transform group-hover:-translate-y-0.5" />
              <span>開房當電視擂台</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>

            {/* Red Action — Join as Phone Controller */}
            <Link
              href="/join"
              className="group flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-rose-400/40 bg-gradient-to-r from-rose-600 via-red-500 to-orange-500 px-8 py-4 text-base font-black text-white shadow-[0_0_30px_rgba(244,63,94,0.4)] transition-all duration-200 hover:scale-105 hover:shadow-[0_0_45px_rgba(244,63,94,0.6)] active:scale-95 sm:w-auto"
            >
              <Smartphone className="h-5 w-5 text-rose-100 transition-transform group-hover:scale-110" />
              <span>手機輸入房號加入</span>
              <Zap className="h-4 w-4 text-yellow-300 transition-transform group-hover:rotate-12" />
            </Link>
          </div>

          {/* DUAL-SCREEN INTERACTIVE MOCKUP SHOWCASE (TV & Phone Side-by-Side) */}
          <div className="relative mx-auto mt-16 max-w-4xl rounded-3xl border border-white/10 bg-black/40 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              {/* Left: TV Stage (Electric Blue) */}
              <div className="w-full flex-1 rounded-2xl border-2 border-cyan-500/50 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950/60 p-5 text-left shadow-lg shadow-cyan-500/10">
                <div className="mb-3 flex items-center justify-between border-b border-cyan-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
                      📺 客廳大螢幕 · 電視端 (TV HOST)
                    </span>
                  </div>
                  <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-200">
                    房號: 78921
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-base font-black text-white">💣 炸彈倒數 · 緊張白熱化！</p>
                    <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 font-mono text-xs font-black text-rose-400 animate-pulse">
                      剩餘 04s
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-3/4 bg-gradient-to-r from-cyan-400 to-blue-500" />
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span className="flex items-center gap-1.5 font-semibold text-cyan-200">
                      <Users className="h-3.5 w-3.5" /> 5 位好友激戰中
                    </span>
                    <span className="text-[11px] text-white/40">即時同步得分榜</span>
                  </div>
                </div>
              </div>

              {/* Middle: Real-Time Zero Delay Pulse Connector */}
              <div className="flex flex-col items-center justify-center gap-1 shrink-0 px-2">
                <div className="flex items-center gap-1 text-xs font-black text-yellow-300 bg-yellow-500/15 border border-yellow-500/30 px-3 py-1 rounded-full shadow-sm">
                  <Zap className="h-3.5 w-3.5" /> 0 秒即時同步
                </div>
                <div className="h-8 w-px bg-gradient-to-b from-cyan-400 to-rose-500 md:h-px md:w-16" />
                <span className="text-[10px] font-bold text-white/40">WebSocket</span>
              </div>

              {/* Right: Phone Controller (Neon Red) */}
              <div className="w-full flex-1 rounded-2xl border-2 border-rose-500/50 bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950/60 p-5 text-left shadow-lg shadow-rose-500/10">
                <div className="mb-3 flex items-center justify-between border-b border-rose-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-rose-400 animate-ping" />
                    <span className="text-xs font-black uppercase tracking-wider text-rose-300">
                      📱 手機就是手把 (CONTROLLER)
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-rose-200">玩家: 派對之王 👑</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-center gap-3 py-1">
                    <button
                      type="button"
                      className="flex-1 rounded-xl border border-rose-400/40 bg-gradient-to-r from-rose-500 to-red-600 py-3 text-center text-sm font-black text-white shadow-md active:scale-95 cursor-default"
                    >
                      剪斷紅線 ✂️
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-xl border border-blue-400/40 bg-gradient-to-r from-blue-500 to-cyan-600 py-3 text-center text-sm font-black text-white shadow-md active:scale-95 cursor-default"
                    >
                      剪斷藍線 ⚡
                    </button>
                  </div>
                  <p className="text-center text-[11px] text-white/50">
                    按鍵自帶觸覺反饋 (Haptic) · 絕無延遲
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Highlights */}
          <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4 md:gap-6">
            {[
              { value: `${GAMES.length} 款`, label: "精選派對遊戲", accent: "text-cyan-400" },
              { value: `${playableCount} 款`, label: "現已全面開放", accent: "text-emerald-400" },
              { value: "4–20 人", label: "支援同房同樂", accent: "text-rose-400" },
              { value: "0 秒", label: "免下載掃碼即玩", accent: "text-yellow-400" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10"
              >
                <p className={`text-2xl font-black md:text-3xl ${stat.accent}`}>{stat.value}</p>
                <p className="mt-1 text-xs font-semibold text-white/50">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — STEP 1, 2, 3 */}
      <section className="relative px-4 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <span className="inline-block rounded-full bg-white/10 px-4 py-1 text-xs font-bold uppercase tracking-wider text-white/70 mb-3">
              SIMPLE & FAST
            </span>
            <h2 className="text-4xl font-black md:text-5xl">三步驟，開趴狂歡！</h2>
            <p className="mx-auto mt-3 max-w-md text-base text-white/50">
              不用下載 App、不用複雜註冊，客廳電視與個人手機無縫連動。
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {/* Step 1: Electric Blue */}
            <div className="rounded-3xl border-2 border-cyan-500/30 bg-gradient-to-b from-cyan-950/30 to-slate-900/60 p-8 shadow-xl transition-all hover:-translate-y-1 hover:border-cyan-400/60">
              <span className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-300 ring-2 ring-cyan-500/30">
                <Monitor className="h-6 w-6" />
              </span>
              <span className="mb-1 block text-xs font-black uppercase tracking-wider text-cyan-400">
                STEP 01
              </span>
              <h3 className="mb-3 text-xl font-black text-white">開一間電視房</h3>
              <p className="text-sm leading-relaxed text-white/60">
                在客廳電視或電腦大螢幕挑選遊戲，一鍵生成專屬五位數代碼與清晰的加入 QR Code。
              </p>
            </div>

            {/* Step 2: Purple Junction */}
            <div className="rounded-3xl border-2 border-purple-500/30 bg-gradient-to-b from-purple-950/30 to-slate-900/60 p-8 shadow-xl transition-all hover:-translate-y-1 hover:border-purple-400/60">
              <span className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-300 ring-2 ring-purple-500/30">
                <QrCode className="h-6 w-6" />
              </span>
              <span className="mb-1 block text-xs font-black uppercase tracking-wider text-purple-400">
                STEP 02
              </span>
              <h3 className="mb-3 text-xl font-black text-white">朋友掃碼加入</h3>
              <p className="text-sm leading-relaxed text-white/60">
                所有人拿起自己的 iPhone 或 Android 手機對準電視掃碼，輸入暱稱秒速進入大廳。
              </p>
            </div>

            {/* Step 3: Fiery Red */}
            <div className="rounded-3xl border-2 border-rose-500/30 bg-gradient-to-b from-rose-950/30 to-slate-900/60 p-8 shadow-xl transition-all hover:-translate-y-1 hover:border-rose-400/60">
              <span className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-300 ring-2 ring-rose-500/30">
                <Zap className="h-6 w-6" />
              </span>
              <span className="mb-1 block text-xs font-black uppercase tracking-wider text-rose-400">
                STEP 03
              </span>
              <h3 className="mb-3 text-xl font-black text-white">手機化身手把開戰</h3>
              <p className="text-sm leading-relaxed text-white/60">
                電視同步遊戲音效與精彩畫面，手機立刻變成專屬按鈕手把、調色盤或投票控制器！
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED GAMES SECTION */}
      <section className="px-4 py-20 bg-white/[0.015]">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">
                <Sparkles className="h-3.5 w-3.5" /> 精選派對熱門
              </span>
              <h2 className="text-3xl font-black md:text-5xl">立刻開玩的招牌遊戲</h2>
            </div>
            <Link
              href="/games"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/10 hover:border-white/20"
            >
              瀏覽全部 {GAMES.length} 款遊戲 <ArrowRight className="h-4 w-4" />
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
      <section className="px-4 py-24">
        <div className="mx-auto max-w-7xl text-center">
          <div className="mb-12">
            <h2 className="mb-3 text-3xl font-black md:text-5xl">今晚想要什麼派對氣氛？</h2>
            <p className="mx-auto max-w-md text-base text-white/50">
              無論是想破冰、比心機、飆手速還是合力解謎，這裡通通有。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {(
              [
                { category: "PARTY", label: "派對破冰", icon: "🎉", desc: "簡單嗨翻", border: "hover:border-cyan-400" },
                { category: "SOCIAL", label: "社交互動", icon: "🧠", desc: "心機推論", border: "hover:border-purple-400" },
                { category: "CREATIVE", label: "創意發揮", icon: "🎨", desc: "畫圖塗鴉", border: "hover:border-emerald-400" },
                { category: "MYSTERY", label: "推理懸疑", icon: "🕵️", desc: "臥底解謎", border: "hover:border-rose-400" },
                { category: "MUSIC", label: "音樂節奏", icon: "🎵", desc: "秒數聽歌", border: "hover:border-yellow-400" },
              ] as const
            ).map((entry) => {
              const count = GAMES.filter((g) => g.category === entry.category).length;
              return (
                <Link
                  key={entry.category}
                  href="/games"
                  className={`group rounded-3xl border border-white/10 bg-white/5 p-6 text-center transition-all hover:-translate-y-1.5 hover:bg-white/10 ${entry.border}`}
                >
                  <p className="mb-3 text-4xl transition-transform group-hover:scale-110" aria-hidden="true">
                    {entry.icon}
                  </p>
                  <p className="mb-1 text-base font-black text-white">{entry.label}</p>
                  <p className="text-xs text-white/40 mb-2">{entry.desc}</p>
                  <span className="inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-white/70">
                    {count} 款遊戲
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Bottom Big Banner CTA */}
          <div className="mt-16 rounded-3xl border-2 border-gradient bg-gradient-to-r from-blue-950/60 via-purple-950/60 to-rose-950/60 p-8 sm:p-12 text-center shadow-2xl">
            <span className="text-4xl mb-3 inline-block">🚀</span>
            <h3 className="text-2xl sm:text-4xl font-black text-white mb-3">
              今晚的派對，就交給 PartyVerse！
            </h3>
            <p className="text-white/60 max-w-xl mx-auto mb-8 text-sm sm:text-base">
              現在就打開客廳電視開啟房間，邀請身旁的親朋好友一起同樂對決！
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/games"
                className="rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-600 px-8 py-4 font-black text-white shadow-lg shadow-cyan-500/30 hover:brightness-110 active:scale-95 transition-all"
              >
                挑選遊戲開房
              </Link>
              <Link
                href="/join"
                className="rounded-2xl border border-rose-400/50 bg-rose-500/20 px-8 py-4 font-black text-rose-300 shadow-lg shadow-rose-500/20 hover:bg-rose-500/30 active:scale-95 transition-all"
              >
                加入現有房間
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 px-4 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="text-center md:text-left">
            <p className="mb-1 text-lg font-black tracking-wider" lang="en">
              <span className="text-cyan-400">PARTY</span>
              <span className="text-rose-500">VERSE</span>
            </p>
            <p className="text-sm text-white/50">One Room. Ten Games. Infinite Chaos.</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/40">
            <span>免下載 · 免安裝 · 跨平台支援</span>
            <span>•</span>
            <span>© {new Date().getFullYear()} PartyVerse</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
