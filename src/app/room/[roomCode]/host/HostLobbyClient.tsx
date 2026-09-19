"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Crown, Power, Settings, Share2, Users, X } from "lucide-react";
import { useRoom } from "@/providers/RoomContext";
import { GAMES } from "@/constants/games";
import type { RoomSettings } from "@/types";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { cn } from "@/lib/utils";

const DIFFICULTIES: Array<{ value: RoomSettings["difficulty"]; label: string }> = [
  { value: "easy", label: "輕鬆" },
  { value: "medium", label: "普通" },
  { value: "hard", label: "地獄" },
];

export default function HostLobbyClient({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const { room, startGame, kickPlayer, endRoom, updateSettings } = useRoom();

  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [origin, setOrigin] = useState("");
  const [error, setError] = useState("");

  // Resolved in an effect so the server and the client's first paint agree;
  // reading `window.location.origin` during render is a hydration mismatch.
  useEffect(() => setOrigin(window.location.origin), []);
  const joinUrl = origin ? `${origin}/join/${roomCode}` : "";

  // Close overlays with Escape.
  useEffect(() => {
    if (!showQR && !showSettings && !confirmingEnd) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setShowQR(false);
      setShowSettings(false);
      setConfirmingEnd(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showQR, showSettings, confirmingEnd]);

  const game = GAMES.find((g) => g.id === room?.gameId);
  const playerList = Object.values(room?.players ?? {}).sort((a, b) =>
    a.isHost === b.isHost ? a.nickname.localeCompare(b.nickname) : a.isHost ? -1 : 1,
  );
  const onlineCount = playerList.filter((p) => p.isConnected).length;
  const minPlayers = game?.minPlayers ?? 2;
  const canStart = onlineCount >= minPlayers;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("無法複製，請手動選取代碼");
    }
  };

  const handleEnd = async () => {
    try {
      await endRoom();
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "無法結束房間");
    }
  };

  return (
    <main className="min-h-screen bg-ink p-4 text-white md:p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 text-center">
          <p className="eyebrow mb-4">Host control room</p>
          <p className="glass mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/50">
            <span aria-hidden="true">{game?.icon}</span> {game?.name}
          </p>
          <h1 className="mb-2 text-4xl font-bold md:text-5xl">遊戲大廳</h1>
          <p className="text-sm text-white/40">分享房間，等大家準備好就開始。</p>
        </header>

        <section className="glass-card mb-6 rounded-2xl p-6 text-center md:p-8" aria-labelledby="room-code-heading">
          <h2 id="room-code-heading" className="mb-2 text-xs uppercase tracking-wider text-white/40">
            房間代碼
          </h2>
          <p
            className="mb-4 text-5xl font-bold tracking-[0.2em] md:text-6xl"
            style={{ color: game?.color ?? "#a855f7" }}
          >
            {roomCode}
          </p>

          {joinUrl && (
            <div className="mb-4 inline-block rounded-2xl bg-white p-4">
              <QRCodeSVG value={joinUrl} size={160} level="H" aria-label={`加入房間 ${roomCode} 的 QR code`} />
            </div>
          )}

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant="ghost" size="md" onClick={handleCopy}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              {copied ? "已複製！" : "複製代碼"}
            </Button>
            <Button variant="ghost" size="md" onClick={() => setShowQR(true)} disabled={!joinUrl}>
              <Share2 className="h-4 w-4" aria-hidden="true" /> 全螢幕 QR
            </Button>
          </div>
        </section>

        <section className="glass mb-6 rounded-2xl border border-white/10 p-5" aria-labelledby="players-heading">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id="players-heading" className="flex items-center gap-2 text-base font-semibold">
              <Users className="h-4 w-4 text-violet-400" aria-hidden="true" />
              玩家（{onlineCount}/{playerList.length}）
            </h2>
            <span className="text-right text-xs text-white/40">
              {canStart ? "可以開始" : `還差 ${Math.max(0, minPlayers - onlineCount)} 位`}
            </span>
          </div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-white/10" aria-label={`開始進度 ${onlineCount} / ${minPlayers}`}>
            <div
              className="h-full rounded-full bg-emerald-400 transition-[width] duration-500"
              style={{ width: `${Math.min(100, (onlineCount / minPlayers) * 100)}%` }}
            />
          </div>
          <ul className="space-y-2">
            {playerList.map((p) => (
              <li
                key={p.id}
                className={cn(
                  "flex items-center justify-between rounded-xl p-3 transition-all",
                  p.isConnected ? "bg-white/5" : "bg-white/5 opacity-40",
                )}
              >
                <span className="flex items-center gap-3">
                  <span className="text-xl" aria-hidden="true">
                    {p.avatar}
                  </span>
                  <span className="text-sm font-medium">{p.nickname}</span>
                  {p.isHost && <Crown className="h-3.5 w-3.5 text-yellow-400" aria-label="房主" />}
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", p.isConnected ? "bg-emerald-400" : "bg-red-500")}
                    aria-label={p.isConnected ? "在線" : "離線"}
                  />
                </span>
                <span className="flex items-center gap-2">
                  {p.isHost && (
                    <span className="rounded-full bg-yellow-400/10 px-2 py-0.5 text-xs font-medium text-yellow-400/80">
                      房主
                    </span>
                  )}
                  {!p.isHost && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`移除 ${p.nickname}`}
                      onClick={() => kickPlayer(p.id).catch((e) => setError(e instanceof Error ? e.message : "無法移除"))}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </span>
              </li>
            ))}
            {playerList.length === 0 && (
              <li className="py-8 text-center text-sm text-white/30">還沒有玩家，快分享代碼！</li>
            )}
          </ul>
        </section>

        <ErrorNote className="mb-4">{error}</ErrorNote>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Button
            variant="ghost"
            size="md"
            disabled={!canStart}
            className="col-span-2 md:col-span-1"
            style={canStart ? { background: "linear-gradient(135deg, #22c55e, #16a34a)" } : undefined}
            onClick={() => startGame().catch((e) => setError(e instanceof Error ? e.message : "無法開始"))}
          >
            <Crown className="h-4 w-4" aria-hidden="true" /> 開始遊戲
          </Button>
          <Button variant="ghost" size="md" onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4" aria-hidden="true" /> 設定
          </Button>
          <Button variant="ghost" size="md" onClick={() => setConfirmingEnd(true)}>
            <Power className="h-4 w-4" aria-hidden="true" /> 結束房間
          </Button>
        </div>

        {!canStart && (
          <p className="mt-4 text-center text-sm text-white/40" role="status">
            這款遊戲至少需要 {minPlayers} 位玩家才能開始
          </p>
        )}
      </div>

      {/* Fullscreen QR */}
      {showQR && joinUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-8"
          role="dialog"
          aria-modal="true"
          aria-label="全螢幕 QR code"
        >
          <div className="text-center">
            <div className="mb-6 inline-block rounded-3xl bg-white p-8">
              <QRCodeSVG value={joinUrl} size={300} level="H" />
            </div>
            <p className="mb-2 text-3xl font-bold tracking-[0.2em]" style={{ color: game?.color ?? "#a855f7" }}>
              {roomCode}
            </p>
            <p className="text-sm text-white/40">掃一下就能加入派對</p>
            <Button variant="ghost" size="md" className="mt-8" onClick={() => setShowQR(false)}>
              關閉
            </Button>
          </div>
        </div>
      )}

      {/* Settings */}
      {showSettings && room && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          <div className="glass-card w-full max-w-sm rounded-2xl p-6">
            <h2 id="settings-title" className="mb-4 text-lg font-bold">
              房間設定
            </h2>

            <fieldset className="mb-4">
              <legend className="mb-2 text-sm font-medium text-white/60">難度</legend>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map((d) => (
                  <Button
                    key={d.value}
                    size="sm"
                    aria-pressed={room.settings.difficulty === d.value}
                    variant={room.settings.difficulty === d.value ? "primary" : "ghost"}
                    onClick={() =>
                      updateSettings({ difficulty: d.value }).catch((e) =>
                        setError(e instanceof Error ? e.message : "無法更新"),
                      )
                    }
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </fieldset>

            <label htmlFor="timer-input" className="mb-2 block text-sm font-medium text-white/60">
              每題秒數：{room.settings.timer}
            </label>
            <input
              id="timer-input"
              type="range"
              min={3}
              max={30}
              value={room.settings.timer}
              onChange={(e) => void updateSettings({ timer: Number(e.target.value) }).catch(() => undefined)}
              className="mb-6 w-full accent-violet-500"
            />

            <Button variant="ghost" size="md" className="w-full" onClick={() => setShowSettings(false)}>
              完成
            </Button>
          </div>
        </div>
      )}

      {/* End-room confirmation — replaces window.confirm(), which blocks the
          main thread and cannot be styled or announced. */}
      {confirmingEnd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-6"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="end-title"
          aria-describedby="end-desc"
        >
          <div className="glass-card w-full max-w-sm rounded-2xl p-6 text-center">
            <h2 id="end-title" className="mb-2 text-lg font-bold">
              要結束這間房嗎？
            </h2>
            <p id="end-desc" className="mb-6 text-sm text-white/50">
              所有玩家都會被移出，房間代碼也會立刻失效。這個動作無法復原。
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="md" className="flex-1" onClick={() => setConfirmingEnd(false)}>
                取消
              </Button>
              <Button variant="danger" size="md" className="flex-1" onClick={() => void handleEnd()}>
                結束房間
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
