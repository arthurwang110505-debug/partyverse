"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Clock, Copy, Crown, Link2, Power, Settings, Share2, Sparkles, Users, X } from "lucide-react";
import { useRoom } from "@/providers/RoomContext";
import { GAMES } from "@/constants/games";
import type { Player } from "@/types";
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

export default function HostLobbyClient({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const { room, startGame, kickPlayer, endRoom, updateSettings, isLocalMode, isHost } = useRoom();

  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [origin, setOrigin] = useState("");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);

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

  const handleEnd = async () => {
    try {
      await endRoom();
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "無法結束房間");
      setConfirmingEnd(false);
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
          <h1 className="mb-2 text-4xl font-bold tracking-tight md:text-5xl">遊戲大廳</h1>
          <p className="text-sm text-white/40">把代碼或 QR code 分享給朋友，手機掃描即可加入</p>
          <p className="mt-3 text-sm text-cyan-200/80">📺 電視不占玩家名額，所有參賽者請用手機加入。</p>
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
          <p className="mb-4 text-5xl font-bold tracking-[0.2em] [color:var(--game-accent,#a855f7)] md:text-6xl">
            {roomCode}
          </p>

          {joinUrl && (
            <>
              <div className="mb-4 inline-block rounded-2xl bg-white p-4 shadow-xl">
                <QRCodeSVG value={joinUrl} size={240} level="H" aria-label={`加入房間 ${roomCode} 的 QR code`} />
              </div>
              <p className="mb-4 break-all font-mono text-sm text-white/60">
                <span className="mb-1 block text-xs uppercase tracking-wider text-white/30">
                  手機瀏覽器直接輸入網址
                </span>
                {joinUrl}
              </p>
            </>
          )}

          <div className="mt-4 flex flex-wrap justify-center gap-2">
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
                  <p className="font-semibold text-white/80">3. 手機即手把</p>
                  <p className="text-[11px] text-white/40">電視看局面，手機同步搶分！</p>
                </div>
              </div>
            </div>
          </section>
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
                      <span className="rounded-full bg-yellow-400/15 border border-yellow-400/30 px-2.5 py-0.5 text-xs font-semibold text-yellow-300">
                        房主
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
                <p className="text-sm text-white/50">還沒有玩家，快分享代碼或掃描 QR code！</p>
                <p className="mt-1 text-xs text-white/40">湊齊 {minPlayers} 人即可開始遊戲同樂。</p>
              </li>
            )}
          </ul>
        </section>

        <ErrorNote className="mb-4">{error}</ErrorNote>

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
              aria-describedby={canStart ? undefined : "start-hint"}
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

        <p id="start-hint" className="mt-4 text-center text-sm text-white/40" role="status">
          {canStart ? (
            <span className="text-emerald-400 font-medium">
              ✨ {onlineCount} 人在線（{readyCount} 人已就緒），隨時可以啟動遊戲！
            </span>
          ) : (
            <>
              <span aria-hidden="true" className="mr-1 tracking-widest text-violet-400">
                {Array.from({ length: Math.max(0, minPlayers) }, (_, i) => (i < onlineCount ? "●" : "○")).join("")}
              </span>
              {onlineCount} / {minPlayers} 位玩家 — 本遊戲至少需要 {minPlayers} 人
              <span className="sr-only">還差 {Math.max(0, minPlayers - onlineCount)} 人</span>
            </>
          )}
        </p>
      </div>

      {/* Fullscreen QR */}
      <Modal open={showQR && Boolean(joinUrl)} onClose={() => setShowQR(false)} label="全螢幕 QR code">
        <div className="text-center">
          <div className="mb-6 inline-block rounded-3xl bg-white p-8 shadow-2xl">
            {joinUrl && <QRCodeSVG value={joinUrl} size={300} level="H" />}
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
