"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Dices, Loader2, Repeat, Sparkles, Users, Wand2 } from "lucide-react";
import { useRoom } from "@/providers/RoomContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { addRecentRoom } from "@/hooks/useRecentRooms";
import { GAMES } from "@/constants/games";
import { MAX_NICKNAME_LENGTH, NICKNAME_KEY } from "@/constants/room";
import { playModeById } from "@/constants/playModes";
import type { PlayModeId } from "@/types";
import {
  buildPlaylist,
  settingsSummary,
  toSessionPlan,
  type Playlist,
} from "@/lib/playlist";
import { loadPlayHistory } from "@/lib/playHistory";
import { sanitizeNickname } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { PlayModePicker } from "@/components/game/PlayModePicker";
import { HostModePicker } from "@/components/game/HostModePicker";
import { useHostModeChoice } from "@/hooks/useHostModeChoice";

const ROLL_MS = 520;

interface Props {
  initialMode?: PlayModeId;
  initialPlayerCount?: number;
}

/**
 * The draw: pick a time box, watch the playlist land, then open the room on the
 * first game. The playlist is stored on the room so every device — and the
 * results screen at the end of each game — knows what comes next.
 */
export default function RandomPartyClient({ initialMode, initialPlayerCount }: Props) {
  const router = useRouter();
  const { createRoom, isLocalMode } = useRoom();

  const [savedNickname, setSavedNickname] = useLocalStorage(NICKNAME_KEY, "");
  const [nickname, setNickname] = useState("");
  const [mode, setMode] = useState<PlayModeId>(initialMode ?? "standard");
  const [playerCount, setPlayerCount] = useState(initialPlayerCount ?? 4);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [drawing, setDrawing] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hostChoice = useHostModeChoice();

  const draw = useCallback((nextMode: PlayModeId, nextCount: number) => {
    // Draw on the client only: the same RNG must not run on the server render.
    if (timer.current) clearTimeout(timer.current);
    setDrawing(true);
    timer.current = setTimeout(() => {
      setPlaylist(
        buildPlaylist({
          mode: nextMode,
          playerCount: nextCount,
          history: loadPlayHistory(),
        }),
      );
      setDrawing(false);
    }, ROLL_MS);
  }, []);

  useEffect(() => {
    draw(mode, playerCount);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // Redraw only when the inputs change; `draw` is stable.
  }, [draw, mode, playerCount]);

  const preset = playModeById(mode)!;
  const rawNickname = nickname || (typeof savedNickname === "string" ? savedNickname : "");
  const effectiveNickname = typeof rawNickname === "string" ? rawNickname : String(rawNickname ?? "");
  const first = playlist?.entries[0];
  const canSubmit = Boolean(first) && effectiveNickname.trim().length > 0 && !creating && !drawing;

  const handleCreate = async () => {
    if (!first || !playlist || !canSubmit) return;
    setError("");
    setCreating(true);
    try {
      const cleanName = sanitizeNickname(effectiveNickname);
      setSavedNickname(cleanName);
      const plan = toSessionPlan(playlist);
      const roomCode = await createRoom(first.gameId, cleanName, first.settings, plan, hostChoice.options);
      addRecentRoom({ code: roomCode, nickname: cleanName, role: "host" });
      router.push(`/room/${roomCode}/host`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "建立房間失敗，請再試一次");
      setCreating(false);
    }
  };

  const skipped = playlist?.avoided ?? [];

  return (
    <main
      className="min-h-screen bg-ink px-4 pb-24 pt-28 text-white"
      style={{ "--game-accent": preset.color, "--game-gradient": preset.gradient } as CSSProperties}
    >
      <Navbar />
      <div className="mx-auto max-w-3xl">
        <Link
          href="/games"
          className="mb-8 inline-flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white/70"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> 返回遊戲列表
        </Link>

        <header className="mb-8">
          <p className="glass mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-violet-300">
            <Dices className="h-4 w-4" aria-hidden="true" />
            隨機時段派對
          </p>
          <h1 className="mb-2 text-3xl font-bold md:text-4xl">時間有多少，就玩多少</h1>
          <p className="text-sm leading-relaxed text-white/45">
            選一個長度，系統會隨機抽出剛好塞得進去的遊戲清單，並盡量避開你們剛玩過的遊戲。
            玩完一款，房主在大螢幕按一下就能接著下一款，不用重新掃碼。
          </p>
        </header>

        <section className="glass-card mb-6 rounded-2xl p-5" aria-labelledby="mode-heading">
          <h2 id="mode-heading" className="mb-3 text-sm font-semibold text-white/80">
            1. 選時間長度
          </h2>
          <PlayModePicker value={mode} onChange={(next) => setMode(next.id)} disabled={creating} />

          <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
            <label htmlFor="player-count" className="text-sm text-white/70">
              <span className="mb-2 flex items-center gap-1.5 font-medium">
                <Users className="h-4 w-4 text-violet-300" aria-hidden="true" /> 預計人數
              </span>
              <select
                id="player-count"
                value={playerCount}
                disabled={creating}
                onChange={(e) => setPlayerCount(Number(e.target.value))}
                className="min-h-11 w-40 rounded-xl border border-white/20 bg-[#141522] px-3 py-2 text-base"
              >
                {Array.from({ length: 19 }, (_, i) => i + 2).map((count) => (
                  <option key={count} value={count}>
                    {count} 人
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs leading-relaxed text-white/40">
              只會抽到人數坐得下的遊戲（{playerCount} 人）。
            </p>
          </div>
        </section>

        <section className="glass-card mb-6 rounded-2xl p-5" aria-labelledby="draw-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="draw-heading" className="text-sm font-semibold text-white/80">
              2. 抽出的清單
            </h2>
            <Button
              variant="ghost"
              size="sm"
              disabled={creating || drawing}
              onClick={() => draw(mode, playerCount)}
            >
              <Dices className="h-3.5 w-3.5" aria-hidden="true" /> 重新抽一次
            </Button>
          </div>

          <div aria-live="polite" aria-busy={drawing}>
            {drawing || !playlist ? (
              <div className="space-y-2">
                {Array.from({ length: mode === "flash" ? 2 : 3 }, (_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-2xl border border-white/5 bg-black/20 p-4"
                  >
                    <Loader2 className="h-4 w-4 animate-spin text-violet-300" aria-hidden="true" />
                    <span className="text-sm text-white/40">抽選中…</span>
                  </div>
                ))}
              </div>
            ) : (
              <motion.ul
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                {playlist.entries.map((entry, index) => {
                  const game = GAMES.find((g) => g.id === entry.gameId);
                  return (
                    <li
                      key={entry.gameId}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3.5"
                      style={{ borderColor: index === 0 ? `${preset.color}66` : undefined }}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold tabular-nums">
                        {index + 1}
                      </span>
                      <span className="text-2xl" aria-hidden="true">
                        {game?.icon ?? "🎮"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-white">{game?.name ?? entry.gameId}</span>
                          {entry.repeated && (
                            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
                              <Repeat className="h-2.5 w-2.5" aria-hidden="true" /> 重複
                            </span>
                          )}
                          {index === 0 && (
                            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                              先玩這款
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-white/45">
                          建議設定 · {settingsSummary(entry.gameId, entry.settings)}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-white/50">約 {entry.minutes} 分</span>
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </div>

          {playlist && !drawing && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-white/50 tabular-nums">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  預估總計 {playlist.totalMinutes} 分（上限 {playlist.budgetMinutes} 分）
                </span>
                <span>{playlist.entries.length} 款遊戲</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40" aria-hidden="true">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (playlist.totalMinutes / playlist.budgetMinutes) * 100)}%`,
                    background: preset.gradient,
                  }}
                />
              </div>
              <p className="text-[11px] leading-relaxed text-white/35">
                預估時間以遊戲的最快節奏計算，不含換場與規則講解，所以實際會略長一些。
              </p>
            </div>
          )}

          {skipped.length > 0 && (
            <p className="mt-3 text-[11px] leading-relaxed text-white/40">
              最近玩過、這次沒排進來的：
              {skipped
                .slice(0, 4)
                .map((id) => GAMES.find((g) => g.id === id)?.name ?? id)
                .join("、")}
              {skipped.length > 4 && ` 等 ${skipped.length} 款`}
            </p>
          )}
        </section>

        <form
          className="glass-card space-y-5 rounded-2xl p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate();
          }}
        >
          <h2 className="text-sm font-semibold text-white/80">3. 開房，然後就開始玩</h2>
          <Field
            label={hostChoice.mode === "phone" ? "房主暱稱（顯示在主持畫面）" : "房主暱稱（顯示在電視上）"}
            name="nickname"
            value={effectiveNickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="輸入你的名字…"
            maxLength={MAX_NICKNAME_LENGTH}
            autoComplete="nickname"
          />
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-white/75">主持方式</legend>
            <HostModePicker
              mode={hostChoice.mode}
              hostPlays={hostChoice.hostPlays}
              onChange={(next) => hostChoice.chooseMode(next.id)}
              onHostPlaysChange={hostChoice.chooseHostPlays}
              disabled={creating}
              size="sm"
            />
          </fieldset>

          <ErrorNote>{error}</ErrorNote>

          <Button type="submit" variant="accent" size="md" className="w-full font-bold" disabled={!canSubmit} loading={creating}>
            {creating ? (
              "建立房間中…"
            ) : (
              <>
                <Wand2 className="h-4 w-4" aria-hidden="true" />
                {first
                  ? `開始 ${preset.label}（先玩 ${GAMES.find((g) => g.id === first.gameId)?.name ?? ""}）`
                  : "開始派對"}
              </>
            )}
          </Button>

          {isLocalMode && (
            <p className="text-center text-xs text-cyan-400/70">
              本地展示模式：只限同一瀏覽器的一般分頁。跨手機連線需要設定 Firebase，無痕視窗不共用房間。
            </p>
          )}
        </form>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-xs leading-relaxed text-white/50">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-white/80">
            <Sparkles className="h-3.5 w-3.5 text-yellow-300" aria-hidden="true" /> 這是怎麼抽的？
          </h2>
          <ul className="list-disc space-y-1 pl-4">
            <li>只抽「在時間上限內玩得完」的遊戲，並把回合數與秒數縮到剛好，所以不會超時。</li>
            <li>同一個時段不會重複同一款遊戲；跨時段則優先挑這台裝置還沒玩過的。</li>
            <li>抽到的建議設定只是建議，房主在大廳仍可自由調整秒數與回合數。</li>
            <li>每一款玩完，結算畫面會自動倒數接著下一款，也可以中途停下來。</li>
          </ul>
        </section>

        <p className="mt-6 text-center text-xs text-white/40">
          想自己挑遊戲？
          <Link href="/games" className="ml-1 text-violet-300 underline-offset-2 hover:underline">
            瀏覽全部 {GAMES.length} 款
          </Link>
        </p>
      </div>
    </main>
  );
}
