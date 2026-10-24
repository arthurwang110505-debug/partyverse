"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  Dices,
  Link2,
  Power,
  Settings,
  Share2,
  SkipForward,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useRoom } from "@/providers/RoomContext";
import { GAMES } from "@/constants/games";
import { playModeById } from "@/constants/playModes";
import type { PlayModeId, Player } from "@/types";
import { buildPlaylist, toSessionPlan } from "@/lib/playlist";
import { loadPlayHistory } from "@/lib/playHistory";
import { PlayModePicker } from "@/components/game/PlayModePicker";
import { SessionPlanPanel } from "@/components/game/SessionPlanPanel";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { Modal } from "@/components/ui/Modal";
import { MuteToggle } from "@/components/game/MuteToggle";
import { ConnectionBadge } from "@/components/game/ConnectionBadge";
import { FloatingReactions } from "@/components/game/FloatingReactions";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { isParticipant } from "@/engine/participants";
import { normalizeSettings } from "@/constants/gameSettings";
import { RoomSettingsFields } from "@/components/game/RoomSettingsFields";
import { hostIsPlaying, isPhoneHostRoom } from "@/lib/hostMode";
import { useScreenWakeLock } from "@/hooks/useScreenWakeLock";

export default function HostLobbyClient({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const {
    room,
    startGame,
    kickPlayer,
    endRoom,
    updateSettings,
    isLocalMode,
    isHost,
    startSession,
    advanceSession,
    toggleReady,
  } = useRoom();

  // A phone is now the room's only screen: keep it from dimming mid-lobby.
  const phoneHost = isPhoneHostRoom(room);
  const hostPlays = hostIsPlaying(room);
  const hostSeat = room?.players[room.hostPlayerId];
  const { supported: wakeLockSupported } = useScreenWakeLock(Boolean(room) && phoneHost);
  const [sharing, setSharing] = useState(false);

  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [origin, setOrigin] = useState("");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionMode, setSessionMode] = useState<PlayModeId>("standard");
  const [drawingSession, setDrawingSession] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const plan = room?.sessionPlan;
  const sessionPreset = plan ? playModeById(plan.mode) : null;
  const nextEntry = plan?.entries[1];
  const nextGame = GAMES.find((g) => g.id === nextEntry?.gameId);

  useEffect(() => setOrigin(window.location.origin), []);
  const joinUrl = origin ? `${origin}/join/${roomCode}` : "";

  const game = GAMES.find((g) => g.id === room?.gameId);
  const playerList = Object.values(room?.players ?? {})
    .filter((p): p is Player => Boolean(p && typeof p === "object") && isParticipant(p))
    .sort((a, b) => (a.isHost === b.isHost ? (a.nickname || "").localeCompare(b.nickname || "") : a.isHost ? -1 : 1));
  const onlineCount = playerList.filter((p) => p.isConnected).length;
  const readyCount = playerList.filter((p) => p.isConnected && p.isReady).length;
  const minPlayers = Math.max(1, game?.minPlayers ?? 2);
  const canStart = onlineCount >= minPlayers;
  const allReady = canStart && readyCount === onlineCount;

  const currentSettings = room?.settings ?? normalizeSettings(room?.gameId ?? "");
  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    setError("");
    try {
      await startGame();
      setConfirmStart(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "無法開始");
      setConfirmStart(false);
    } finally {
      setStarting(false);
    }
  };

  const prevCount = useRef<number | null>(null);
  useEffect(() => {
    if (prevCount.current !== null && playerList.length > prevCount.current) {
      sfx.playChime();
    }
    prevCount.current = playerList.length;
  }, [playerList.length]);

  const copyText = async (text: string, setFlag: (v: boolean) => void, failure: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setFlag(true);
      setTimeout(() => setFlag(false), 2000);
    } catch {
      setError(failure);
    }
  };

  /**
   * Phones are usually in someone's hand, not on a shelf: the native share
   * sheet beats "point your camera at my screen". Falls back to copying the
   * link when the browser has no share support (or the user cancels).
   */
  const handleShare = async () => {
    if (!joinUrl || sharing) return;
    const title = `${game?.name ?? "PARTYVERSE"} · 房間 ${roomCode}`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      setSharing(true);
      try {
        await navigator.share({ title, text: `一起玩 ${game?.name ?? "派對遊戲"}！房間代碼 ${roomCode}`, url: joinUrl });
        return;
      } catch (e) {
        // AbortError means the sheet was dismissed — do not also copy.
        if (e instanceof Error && e.name === "AbortError") return;
      } finally {
        setSharing(false);
      }
    }
    await copyText(joinUrl, setCopiedLink, "無法分享，請手動複製連結");
  };

  const handleEnd = async () => {
    try {
      await endRoom();
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "無法結束房間");
      setConfirmingEnd(false);
    }
  };

  /** Draw a playlist for the chosen time box and load its first game. */
  const handleDrawSession = async () => {
    setDrawingSession(true);
    setError("");
    try {
      const playlist = buildPlaylist({
        mode: sessionMode,
        playerCount: Math.max(2, onlineCount),
        history: loadPlayHistory(),
      });
      if (!playlist.entries.length) throw new Error("這個人數與時間找不到合適的遊戲，換個模式再試");
      setShowSessionModal(false);
      await startSession(toSessionPlan(playlist));
    } catch (e) {
      setError(e instanceof Error ? e.message : "抽選失敗，請再試一次");
    } finally {
      setDrawingSession(false);
    }
  };

  /** Skip the game in the lobby and load the next one from the playlist. */
  const handleSkipSession = async () => {
    setSkipping(true);
    setError("");
    try {
      await advanceSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : "無法跳到下一款");
    } finally {
      setSkipping(false);
    }
  };

  return (
    <main
      className="min-h-[100dvh] bg-ink p-4 text-white md:p-8 relative"
      style={{ "--game-accent": game?.color, "--game-gradient": game?.gradient } as CSSProperties}
    >
      <FloatingReactions />

      <div className="mx-auto max-w-4xl relative z-10">
        <div className="mb-4 flex items-center justify-between">
          <ConnectionBadge />
          <MuteToggle />
        </div>

        <header className="mb-8 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            <p className="glass inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/70">
              <span aria-hidden="true">{game?.icon}</span> {game?.name}
              <span className="text-white/30">·</span>
              <span className="text-xs text-white/50">{game?.estimatedDuration}</span>
            </p>
          </div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight md:text-5xl">
            {phoneHost ? "手機主持" : "遊戲大廳"}
          </h1>
          <p className="text-sm text-white/40">
            {phoneHost ? "這支手機就是全場的主持畫面，不用電視或電腦" : "把代碼或 QR code 分享給朋友，手機掃描即可加入"}
          </p>
          {phoneHost ? (
            <p className="mt-3 text-sm text-violet-200/85">
              📱 {hostPlays ? "你也是玩家：開打後可切換「主持畫面」與「我的手把」。" : "這支手機只負責主持與顯示，不占玩家名額。"}
            </p>
          ) : (
            <p className="mt-3 text-sm text-cyan-200/80">📺 電視不占玩家名額，所有參賽者請用手機加入。</p>
          )}
          {phoneHost && (
            <p className="mt-2 text-xs leading-relaxed text-white/40">
              {wakeLockSupported
                ? "主持中會請瀏覽器保持螢幕亮著；仍請保持這個分頁在前景。"
                : "主持中請保持這個畫面開啟、螢幕不要關閉，遊戲計時才會繼續。"}
            </p>
          )}
          {isLocalMode && (
            <p className="mt-2 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
              本地展示：房間只在這個瀏覽器內同步，請用「開新分頁當玩家」。跨手機或無痕視窗需設定 Firebase。
            </p>
          )}
        </header>

        {/* Room Code & QR Card */}
        <section className="glass-card mb-6 rounded-2xl p-6 text-center" aria-labelledby="room-code-heading">
          <h2 id="room-code-heading" className="mb-2 text-xs uppercase tracking-wider text-white/40">
            房間代碼
          </h2>
          <p className="mb-4 text-4xl font-bold tracking-[0.2em] [color:var(--game-accent,#a855f7)] sm:text-5xl md:text-6xl">
            {roomCode}
          </p>

          {joinUrl && (
            <>
              <div
                className={cn(
                  "mb-4 inline-block rounded-2xl bg-white shadow-xl ring-4 ring-white/10",
                  phoneHost ? "p-3.5" : "p-5",
                )}
              >
                <QRCodeSVG
                  value={joinUrl}
                  size={phoneHost ? 200 : 280}
                  level="H"
                  aria-label={`加入房間 ${roomCode} 的 QR code`}
                  className={phoneHost ? "h-auto w-[min(48vw,200px)]" : "h-auto w-[min(70vw,280px)]"}
                />
              </div>
              <p className="mb-1 text-xs uppercase tracking-wider text-white/50">手機瀏覽器直接輸入網址</p>
              <p className="mb-4 break-all font-mono text-base font-semibold text-cyan-200/90 md:text-lg">{joinUrl}</p>
            </>
          )}

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {phoneHost && (
              <Button
                variant="accent"
                size="md"
                className="min-w-40 font-bold"
                disabled={!joinUrl || sharing}
                loading={sharing}
                onClick={() => void handleShare()}
              >
                <Share2 className="h-4 w-4" aria-hidden="true" /> 分享邀請
              </Button>
            )}
            <Button
              variant="ghost"
              size="md"
              onClick={() => void copyText(roomCode, setCopied, "無法複製，請手動選取代碼")}
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              {copied ? "已複製！" : "複製代碼"}
            </Button>
            <Button
              variant="ghost"
              size="md"
              disabled={!joinUrl}
              onClick={() => void copyText(joinUrl, setCopiedLink, "無法複製連結")}
            >
              <Link2 className="h-4 w-4" aria-hidden="true" />
              {copiedLink ? "已複製連結！" : "複製邀請連結"}
            </Button>
            <Button variant="ghost" size="md" onClick={() => setShowQR(true)} disabled={!joinUrl}>
              <Share2 className="h-4 w-4" aria-hidden="true" /> 全螢幕 QR
            </Button>
            {isLocalMode && (
              <Link
                href={`/join/${roomCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200"
              >
                開新分頁當玩家 ↗
              </Link>
            )}
          </div>
        </section>

        {/* 3-Step Quick Guide */}
        {game && (
          <section className="glass mb-6 rounded-2xl border border-white/10 p-5 text-left" aria-label="遊戲簡介">
            <h3 className="mb-1 text-sm font-semibold text-white/80 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" aria-hidden="true" />
              玩法簡介 · {game.name}
            </h3>
            <p className="mb-4 text-xs leading-relaxed text-white/60">{game.description}</p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 text-xs">
              <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/5 p-3">
                <span className="text-xl">📱</span>
                <div>
                  <p className="font-semibold text-white/80">1. 掃碼加入</p>
                  <p className="text-[11px] text-white/40">無需安裝，填寫暱稱秒連線</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/5 p-3">
                <span className="text-xl">🎯</span>
                <div>
                  <p className="font-semibold text-white/80">2. 點擊準備就緒</p>
                  <p className="text-[11px] text-white/40">手機按「就緒」，人數到齊開始</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/5 p-3">
                <span className="text-xl">🏆</span>
                <div>
                  <p className="font-semibold text-white/80">3. {phoneHost ? "一支手機搞定" : "手機即手把"}</p>
                  <p className="text-[11px] text-white/40">
                    {phoneHost
                      ? hostPlays
                        ? "主持畫面與我的手把隨時切換"
                        : "這支手機顯示局面，其他人手機搶分"
                      : "電視看局面，手機同步搶分！"}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Random party session: what the draw picked for this room. */}
        {plan ? (
          <div className="mb-6">
            <SessionPlanPanel plan={plan} showSettings />
            <div className="mt-2 flex flex-wrap gap-2">
              {nextEntry && (
                <Button variant="ghost" size="sm" loading={skipping} onClick={() => void handleSkipSession()}>
                  <SkipForward className="h-3.5 w-3.5" aria-hidden="true" /> 跳過這款，先玩 {nextGame?.name}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setShowSessionModal(true)}>
                <Dices className="h-3.5 w-3.5" aria-hidden="true" /> 重抽時段
              </Button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-white/40">
              建議設定只是建議：按下方「設定」可以自由調整秒數與回合數。想改回自己挑遊戲，直接從結算畫面換一款即可。
            </p>
          </div>
        ) : (
          isHost && (
            <section className="mb-6 rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-4" aria-label="隨機時段派對">
              <p className="mb-1 flex items-center gap-2 text-sm font-bold text-cyan-100">
                <Dices className="h-4 w-4" aria-hidden="true" /> 不知道玩什麼？抽一個隨機時段
              </p>
              <p className="mb-3 text-xs leading-relaxed text-cyan-100/75">
                選 3 / 5 / 10 分鐘，系統隨機抽出塞得進這段時間的遊戲清單，並盡量避開最近玩過的遊戲。
                玩完一款自動接下一款，全場都不用重新掃碼。
              </p>
              <Button variant="accent" size="md" className="font-bold" onClick={() => setShowSessionModal(true)}>
                <Dices className="h-4 w-4" aria-hidden="true" /> 抽一個時段
              </Button>
            </section>
          )
        )}

        {/* Player List */}
        <section className="glass mb-6 rounded-2xl border border-white/10 p-5" aria-labelledby="players-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="players-heading" className="flex items-center gap-2 text-base font-semibold">
              <Users className="h-4 w-4 text-violet-400" aria-hidden="true" />
              玩家名單（{onlineCount}/{playerList.length} 在線 · {readyCount} 人就緒）
            </h2>
            {canStart && (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> 人數達標
              </span>
            )}
          </div>

          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {playerList.map((p) => (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
                  className={cn(
                    "flex items-center justify-between rounded-xl p-3 transition-colors border",
                    p.isConnected ? "bg-white/5 border-white/10" : "bg-white/5 opacity-40 border-transparent",
                    p.isReady && p.isConnected && "border-emerald-500/30 bg-emerald-500/5",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true">
                      {p.avatar}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{p.nickname}</span>
                      {p.isHost && <Crown className="h-3.5 w-3.5 text-yellow-400" aria-label="房主" />}
                    </span>
                    <span
                      className={cn("h-2 w-2 rounded-full", p.isConnected ? "bg-emerald-400" : "bg-red-500")}
                      aria-label={p.isConnected ? "在線" : "離線"}
                    />
                  </span>
                  <span className="flex items-center gap-2">
                    {p.isHost ? (
                      <span className="flex items-center gap-1.5">
                        <span className="rounded-full bg-yellow-400/15 border border-yellow-400/30 px-2.5 py-0.5 text-xs font-semibold text-yellow-300">
                          房主
                        </span>
                        {isParticipant(p) &&
                          (p.isReady ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" /> 已就緒
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-xs font-medium text-white/40">
                              <Clock className="h-3 w-3" /> 待命中
                            </span>
                          ))}
                      </span>
                    ) : p.isReady ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> 已就緒
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-xs font-medium text-white/40">
                        <Clock className="h-3 w-3" /> 待命中
                      </span>
                    )}

                    {!p.isHost && isHost && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`移除 ${p.nickname}`}
                        onClick={() =>
                          kickPlayer(p.id).catch((e) => setError(e instanceof Error ? e.message : "無法移除"))
                        }
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    )}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
            {playerList.length === 0 && (
              <li className="py-8 text-center">
                <p className="text-sm text-white/60">還沒有玩家，快分享代碼或掃描 QR code！</p>
                <p className="mt-1 text-xs text-white/50">湊齊 {minPlayers} 人即可開始遊戲同樂。</p>
                <ol className="mx-auto mt-4 flex max-w-sm flex-col gap-1.5 text-left text-xs text-white/55">
                  <li>① 朋友掃上方 QR 或輸入代碼</li>
                  <li>② 手機填暱稱，點「就緒」</li>
                  <li>③ 人數達標後，房主按開始</li>
                </ol>
              </li>
            )}
          </ul>
        </section>

        <ErrorNote className="mb-4">{error}</ErrorNote>

        {isHost && hostPlays && hostSeat && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-400/25 bg-violet-500/10 p-3">
            <p className="min-w-0 text-xs leading-relaxed text-violet-100/80">
              <span className="font-bold text-white">你也在這場比賽裡。</span> 按「就緒」告訴大家你準備好了。
            </p>
            <Button
              size="sm"
              variant={hostSeat.isReady ? "ghost" : "accent"}
              className="shrink-0 font-bold"
              onClick={() =>
                void toggleReady().catch((e) => setError(e instanceof Error ? e.message : "無法更新就緒狀態"))
              }
            >
              {hostSeat.isReady ? "取消我的就緒" : "我也準備好了"}
            </Button>
          </div>
        )}

        {isHost && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Button
              variant="accent"
              size="md"
              disabled={!canStart || starting}
              loading={starting}
              className={cn(
                "col-span-2 md:col-span-1 font-bold transition-all shadow-lg",
                allReady && "ring-2 ring-emerald-400 ring-offset-2 ring-offset-ink scale-105",
              )}
              aria-describedby="start-hint"
              onClick={() => (allReady ? void handleStart() : setConfirmStart(true))}
            >
              <Crown className="h-4 w-4" aria-hidden="true" />
              {allReady ? "全員就緒！立刻開始" : "開始遊戲"}
            </Button>
            <Button variant="ghost" size="md" onClick={() => setShowSettings(true)}>
              <Settings className="h-4 w-4" aria-hidden="true" /> 設定
            </Button>
            <Button variant="ghost" size="md" onClick={() => setConfirmingEnd(true)}>
              <Power className="h-4 w-4" aria-hidden="true" /> 結束房間
            </Button>
          </div>
        )}

        <div id="start-hint" className="mt-4 space-y-2 text-center text-sm text-white/50" role="status">
          <p className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs uppercase tracking-wider text-white/40">人數</span>
            <span aria-hidden="true" className="tracking-[0.35em] text-lg text-violet-300">
              {Array.from({ length: Math.max(0, minPlayers) }, (_, i) => (i < onlineCount ? "●" : "○")).join("")}
            </span>
            <span className="tabular-nums">
              {onlineCount} / {minPlayers}
            </span>
          </p>
          {canStart && onlineCount > 0 && (
            <p className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs uppercase tracking-wider text-white/40">就緒</span>
              <span aria-hidden="true" className="tracking-[0.35em] text-lg text-emerald-300">
                {Array.from({ length: onlineCount }, (_, i) => (i < readyCount ? "●" : "○")).join("")}
              </span>
              <span className="tabular-nums">
                {readyCount} / {onlineCount}
              </span>
            </p>
          )}
          <p className={cn("font-medium", canStart ? "text-emerald-300" : "text-white/55")}>
            {canStart
              ? allReady
                ? "✨ 全員就緒，可以立刻開玩！"
                : `✨ 人數達標（${readyCount} 人已就緒），可開始或再等一下`
              : `還差 ${Math.max(0, minPlayers - onlineCount)} 人才能開始 · 本遊戲至少 ${minPlayers} 人`}
          </p>
        </div>
      </div>

      {/* Fullscreen QR */}
      <Modal open={showQR && Boolean(joinUrl)} onClose={() => setShowQR(false)} label="全螢幕 QR code">
        <div className="text-center">
          <div className="mb-6 inline-block rounded-3xl bg-white p-8 shadow-2xl">
            {joinUrl && (
              <QRCodeSVG value={joinUrl} size={300} level="H" className="h-auto w-[min(70vw,300px)]" />
            )}
          </div>
          <p className="mb-2 text-3xl font-bold tracking-[0.2em] [color:var(--game-accent,#a855f7)]">{roomCode}</p>
          <p className="text-sm text-white/40">手機相機掃描，立即加入</p>
          <Button variant="ghost" size="md" className="mt-8" onClick={() => setShowQR(false)}>
            關閉
          </Button>
        </div>
      </Modal>

      {/* Settings */}
      <Modal open={showSettings && Boolean(room)} onClose={() => setShowSettings(false)} title="房間設定">
        {room && (
          <>
            <div className="mb-6">
              <RoomSettingsFields
                gameId={room.gameId}
                settings={currentSettings}
                onChange={(patch) =>
                  void updateSettings(patch).catch((e) => setError(e instanceof Error ? e.message : "無法更新設定"))
                }
              />
            </div>

            <Button variant="ghost" size="md" className="w-full" onClick={() => setShowSettings(false)}>
              完成
            </Button>
          </>
        )}
      </Modal>

      {/* Random session draw */}
      <Modal open={showSessionModal} onClose={() => setShowSessionModal(false)} title="抽一個隨機時段">
        <p className="mb-4 text-xs leading-relaxed text-white/55">
          目前有 {onlineCount} 位手機玩家，只會抽他們玩得起的遊戲。抽完會直接換到第一款的大廳。
        </p>
        <PlayModePicker value={sessionMode} onChange={(next) => setSessionMode(next.id)} />
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" size="md" className="flex-1" onClick={() => setShowSessionModal(false)}>
            取消
          </Button>
          <Button
            variant="accent"
            size="md"
            className="flex-1 font-bold"
            loading={drawingSession}
            onClick={() => void handleDrawSession()}
          >
            <Dices className="h-4 w-4" aria-hidden="true" /> 開始抽
          </Button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-white/40">
          {plan
            ? `抽新的時段會取代目前這份「${sessionPreset?.label ?? ""}」清單。`
            : "抽到的建議設定會先套用，但按「設定」仍可自由調整。"}
        </p>
      </Modal>

      <Modal open={confirmStart} onClose={() => setConfirmStart(false)} title="仍有玩家未就緒" role="alertdialog">
        <p className="mb-5 text-sm text-white/70">
          {onlineCount - readyCount} 位玩家還沒按就緒。確認大家看懂規則後再開始。
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setConfirmStart(false)}>
            再等一下
          </Button>
          <Button variant="accent" loading={starting} onClick={() => void handleStart()}>
            仍然開始
          </Button>
        </div>
      </Modal>

      {/* End-room confirmation */}
      <Modal open={confirmingEnd} onClose={() => setConfirmingEnd(false)} title="要結束這間房嗎？" role="alertdialog">
        <p className="mb-6 text-sm text-white/50">所有玩家都會被移出，房間代碼也會立刻失效。這個動作無法復原。</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="md" className="flex-1" onClick={() => setConfirmingEnd(false)}>
            取消
          </Button>
          <Button variant="danger" size="md" className="flex-1" onClick={() => void handleEnd()}>
            結束房間
          </Button>
        </div>
      </Modal>
    </main>
  );
}
