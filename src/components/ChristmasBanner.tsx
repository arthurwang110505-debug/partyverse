"use client";

import Link from "next/link";
import { ArrowRight, Gift, Snowflake, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChristmasBannerProps {
  compact?: boolean;
}

export function ChristmasBanner({ compact = false }: ChristmasBannerProps) {
  return (
    <section
      aria-label="聖誕限定特企"
      className={cn(
        "relative overflow-hidden rounded-3xl border-2 border-emerald-400/40 bg-gradient-to-br from-[#1f0910]/90 via-[#071f17]/90 to-[#1e1806]/90 shadow-[0_0_40px_rgba(16,185,129,0.18)]",
        compact ? "p-5 sm:p-6" : "p-6 sm:p-10",
      )}
    >
      {/* Top festive lights strip */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-500 via-amber-300 to-emerald-400"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 text-left">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/50 bg-red-500/20 px-3 py-1 text-xs font-black tracking-wider text-red-200">
              <Gift className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
              CHRISTMAS SPECIAL OFFER
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-200">
              <Sparkles className="h-3 w-3 text-amber-300" aria-hidden="true" />
              聖誕限定企劃 + 狼人殺上線
            </span>
          </div>

          <h2 className={cn("font-black tracking-tight text-white", compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-4xl")}>
            🎄 聖誕派對特別企劃：限定遊戲 ＆ 飄雪主題免費開放！
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-emerald-100/80">
            全場預設開啟聖誕特別企劃：<strong className="text-amber-300">「🎁 聖誕驚喜禮物盒」</strong>、全站飄雪特效、聖誕鈴鐺音效與{" "}
            <span aria-hidden="true">🎅🤶🦌⛄</span> 聖誕限定頭像！全新社交推理大作{" "}
            <strong className="text-rose-300">「🐺 狼人殺」</strong> 也同步熱血開局！
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/75">
            <span className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">
              <Snowflake className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" /> 全站飄雪視覺
            </span>
            <span className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">🎁 聖誕限定拆禮大戰</span>
            <span className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">🔔 聖誕鈴鐺音效</span>
            <span className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">🐺 狼人殺經典登場</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row lg:flex-col">
          <Link
            href="/games/christmasgift"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-amber-300/70 bg-gradient-to-r from-red-600 via-rose-600 to-emerald-600 px-5 py-3 text-sm font-black text-white shadow-[0_0_25px_rgba(239,68,68,0.45)] transition-transform hover:scale-[1.02] active:scale-95"
          >
            <span>🎁 玩聖誕限定遊戲</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>

          <Link
            href="/games/werewolf"
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-rose-400/40 bg-rose-950/60 px-5 py-2.5 text-xs font-bold text-rose-200 transition-colors hover:bg-rose-900/70"
          >
            <span>🐺 立即挑戰狼人殺</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
