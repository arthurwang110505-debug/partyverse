"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Copy, Dices, Gamepad2, Home, Pause, Play, RotateCcw, Sparkles, Timer } from "lucide-react";
import { useRoom } from "@/providers/RoomContext";
import { GAMES } from "@/constants/games";
import { BATTLE_GAME_COUNT, BATTLE_MIN_PLAYERS } from "@/constants/playModes";
import { isPlayable } from "@/engine";
import { buildPlaylist, toSessionPlan } from "@/lib/playlist";
import { loadPlayHistory, rememberPlayedGame } from "@/lib/playHistory";
import { PlayModePicker } from "@/components/game/PlayModePicker";
import { SessionPlanPanel } from "@/components/game/SessionPlanPanel";
import type { Achievement, PlayModeId } from "@/types";
import type { BombGameState } from "@/engine/bombCountdown";
import { Button, LinkButton } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { Modal } from "@/components/ui/Modal";
import { Confetti } from "@/components/game/Confetti";
import { FloatingReactions } from "@/components/game/FloatingReactions";
import { useCountUp } from "@/hooks/useCountUp";
import { sfx, vibrate } from "@/lib/sound";
import { buildMatchRecap, formatMatchReport, formatTournamentReport } from "@/lib/matchRecap";
import { participantIds } from "@/engine/participants";
import { cn, formatTime } from "@/lib/utils";

interface Props {
  roomCode: string;
}

interface RankedPlayer {
  id: string;
  nickname: string;
  avatar: string;
  isHost: boolean;
  isMe: boolean;
  score: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];
const PODIUM_ORDER = [1, 0, 2];
const REACTIONS = ["🎉", "👑", "🔥", "💩", "👏", "❤️"];
/** Grace period before a random session rolls into the next game on its own. */
const AUTO_ADVANCE_SECONDS = 20;

/** Podium score with a count-up entrance animation. */
function AnimatedScore({ value, className }: { value: number; className?: string }) {
  const animated = useCountUp(value);
  return <p className={cn("text-sm font-bold tabular-nums", className)}>{animated} 分</p>;
}

export default function ResultsClient({ roomCode }: Props) {
  const router = useRouter();
  const { room, player, isHost, rematch, endRoom, switchGame, sendReaction, voteNextGame, startSession, advanceSession } =
    useRoom();
  const [restarting, setRestarting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(AUTO_ADVANCE_SECONDS);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionMode, setSessionMode] = useState<PlayModeId>("standard");
  const [drawing, setDrawing] = useState(false);
  const advancingRef = useRef(false);
  const [error, setError] = useState("");
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [copiedScores, setCopiedScores] = useState(false);

  const game = GAMES.find((g) => g.id === room?.gameId);
  const state = room?.gameState as (BombGameState & { achievements?: Achievement[] }) | undefined;
  const plan = room?.sessionPlan;
  const battleMode = plan?.mode === "battle";
  const tournamentFinalGame = Boolean(battleMode && room?.status === "RESULTS" && plan?.entries.length === 1);
  const tournamentFinished = Boolean(
    battleMode &&
      ((plan?.entries.length === 0 && plan.played.length === BATTLE_GAME_COUNT) ||
        (tournamentFinalGame && (plan?.played.length ?? 0) + 1 === BATTLE_GAME_COUNT)),
  );

  // During game eight, include its just-finished score in the preview. The host
  // then closes the plan once, persisting this same total before the ranking is
  // shown to everyone. Earlier rounds never render this scoreboard.
  const tournamentScores = useMemo<Record<string, number> | null>(() => {
    if (!battleMode || !plan) return null;
    const totals = { ...(plan.totalScores ?? {}) };
    if (tournamentFinalGame) {
      for (const id of room?.participantIds ?? []) totals[id] ??= 0;
      for (const [id, score] of Object.entries(state?.currentScores ?? {})) {
        if (typeof score === "number" && Number.isFinite(score)) totals[id] = (totals[id] ?? 0) + score;
      }
    }
    return totals;
  }, [battleMode, plan, room?.participantIds, state?.currentScores, tournamentFinalGame]);

  const ranked = useMemo<RankedPlayer[]>(() => {
    if (!room) return [];
    const scores = battleMode ? tournamentScores ?? {} : state?.currentScores ?? {};
    const ids = battleMode
      ? Object.keys(scores).filter((id) => room.players[id] && room.players[id].role !== "display")
      : participantIds(room);
    return ids
      .map((id) => {
        const p = room.players[id];
        return {
          id,
          nickname: p.nickname,
          avatar: p.avatar,
          isHost: p.isHost,
          isMe: id === player?.id,
          score: scores[id] ?? 0,
        };
      })
      .sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
  }, [room, state?.currentScores, tournamentScores, battleMode, player?.id]);

  const podium = PODIUM_ORDER.map((i) => ({ entry: ranked[i], slot: i })).filter(({ entry }) => Boolean(entry));
  const gameWinners = (room?.gameState.winnerIds as string[] | undefined) ?? [];
  const winners = battleMode
    ? tournamentFinished && ranked.length > 0
      ? ranked.filter((entry) => entry.score === ranked[0].score).map((entry) => entry.id)
      : []
    : gameWinners;
  const cooperative = room?.gameId === "mysteryroom";
  const teamVictory = !battleMode && (cooperative || room?.gameId === "whoisundercoveragent");
  const showRankings = !battleMode || tournamentFinished;
  const rankOf = (entry: RankedPlayer) => ranked.findIndex((p) => p.score === entry.score);

  const achievements = state?.achievements ?? [];
  const elapsed = room?.startedAt
    ? Math.max(0, Math.round(((room.finishedAt ?? Date.now()) - room.startedAt) / 1000))
    : null;

  const totalScore = ranked.reduce((sum, r) => sum + r.score, 0);
  const leader = ranked[0];
  const recap = useMemo(() => (room && !battleMode ? buildMatchRecap(room) : []), [room, battleMode]);

  // ---- Randomized party sessions: time boxes and the 8-game battle mode ----
  const nextEntry = plan?.entries[1];
  const nextGame = GAMES.find((g) => g.id === nextEntry?.gameId);
  const sessionActive = Boolean(plan && plan.entries.length > 0);
  const finalizeBattleRef = useRef(false);
  const [finalizingBattle, setFinalizingBattle] = useState(false);

  const finalizeBattle = useCallback(async () => {
    if (finalizeBattleRef.current) return;
    finalizeBattleRef.current = true;
    setFinalizingBattle(true);
    setError("");
    try {
      await advanceSession();
    } catch (e) {
      finalizeBattleRef.current = false;
      setError(e instanceof Error ? e.message : "無法公布決戰排名");
    } finally {
      setFinalizingBattle(false);
    }
  }, [advanceSession]);

  useEffect(() => {
    if (isHost && tournamentFinalGame) void finalizeBattle();
  }, [finalizeBattle, isHost, tournamentFinalGame]);

  // Remember what got played so the next draw can avoid it ("盡量不重複").
  const gameId = room?.gameId;
  useEffect(() => {
    if (gameId) rememberPlayedGame(gameId);
  }, [gameId]);

  const handleAdvance = useCallback(async () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setAdvancing(true);
    try {
      await advanceSession();
      // The room drops back to LOBBY; this page redirects to the host screen.
    } catch (e) {
      setError(e instanceof Error ? e.message : "無法前往下一款");
      setAutoCountdown(null);
    } finally {
      advancingRef.current = false;
      setAdvancing(false);
    }
  }, [advanceSession]);

  // Auto-roll through the playlist, with a pause for anyone still reading scores.
  useEffect(() => {
    if (!isHost || !nextEntry || autoCountdown === null || advancing) return;
    if (autoCountdown <= 0) {
      void handleAdvance();
      return;
    }
    const timer = setTimeout(() => setAutoCountdown((seconds) => (seconds === null ? null : seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [advancing, autoCountdown, handleAdvance, isHost, nextEntry]);

  const sessionPlayerCount = room ? Math.max(2, participantIds(room).length) : 4;
  const tournamentGameIds =
    tournamentFinalGame && plan?.entries[0]
      ? [...plan.played, plan.entries[0].gameId]
      : plan?.played ?? [];

  const handleDrawSession = async () => {
    setDrawing(true);
    setError("");
    try {
      // Seat the draw to the phones that actually played this match.
      const playlist = buildPlaylist({
        mode: sessionMode,
        playerCount: sessionPlayerCount,
        history: loadPlayHistory(),
      });
      if (playlist.targetGames && playlist.entries.length !== playlist.targetGames) {
        throw new Error(`決戰模式需要 ${playlist.targetGames} 款不同遊戲；至少需要 ${BATTLE_MIN_PLAYERS} 位玩家。`);
      }
      if (!playlist.entries.length) throw new Error("人數或時間找不到合適的遊戲，換個模式再試");
      setShowSessionModal(false);
      await startSession(toSessionPlan(playlist));
      // Room returns to LOBBY with the next game loaded; this page redirects.
    } catch (e) {
      setError(e instanceof Error ? e.message : "抽選失敗，請再試一次");
    } finally {
      setDrawing(false);
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

  const handleSwitchGame = async (targetGameId: string) => {
    try {
      await switchGame(targetGameId);
      setShowSwitchModal(false);
      router.push(`/room/${roomCode}/host`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "切換遊戲失敗");
    }
  };

  const handleCopyScores = async () => {
    if (!room || ranked.length === 0) return;
    vibrate(15);
    sfx.playPop();
    try {
      await navigator.clipboard.writeText(
        battleMode && tournamentFinished
          ? formatTournamentReport(room, tournamentScores ?? {}, BATTLE_GAME_COUNT)
          : formatMatchReport(room, game?.name ?? "遊戲"),
      );
      setCopiedScores(true);
      setTimeout(() => setCopiedScores(false), 2000);
    } catch {
      setError("無法複製戰報");
    }
  };

  const handleReaction = async (emoji: string) => {
    vibrate(12);
    await sendReaction(emoji);
  };

  if (!room) return null;

  const playableGames = GAMES.filter((g) => isPlayable(g.id) && g.id !== room.gameId);
  const nextVotes = room.nextGameVotes ?? {};
  const myNextVote = player ? nextVotes[player.id] : undefined;
  const voteTally = playableGames
    .map((g) => ({
      game: g,
      count: Object.values(nextVotes).filter((id) => id === g.id).length,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
  const topVoted = voteTally[0];

  const handleVoteNext = async (gameId: string) => {
    vibrate(12);
    try {
      await voteNextGame(gameId);
      sfx.playPop();
    } catch (e) {
      setError(e instanceof Error ? e.message : "投票失敗");
    }
  };

  return (
    <main
      className="min-h-[100dvh] bg-ink p-4 pb-safe text-white relative"
      style={{ "--game-accent": game?.color, "--game-gradient": game?.gradient } as CSSProperties}
    >
      {/* Always celebrate the end of a night — even cooperative near-misses. */}
      <Confetti />
      <FloatingReactions />

      <div className="mx-auto max-w-lg pt-8 relative z-10">
        <header className="mb-8 text-center">
          <p className="mb-4 text-5xl animate-bounce" aria-hidden="true">
            🏆
          </p>
          <h1 className="mb-2 text-3xl font-black tracking-tight">
            {battleMode
              ? tournamentFinished
                ? "決戰最終排名"
                : "決戰進行中"
              : cooperative
                ? room.gameState.isUnlocked
                  ? "全員合作成功！"
                  : "挑戰未完成"
                : "遊戲結算"}
          </h1>
          {battleMode ? (
            tournamentFinished ? (
              winners.length > 0 && (
                <p className="mb-3 text-sm leading-relaxed text-yellow-200" role="status">
                  {winners.length > 1 ? "決戰並列冠軍" : "決戰冠軍"}：
                  {winners.map((id) => room.players[id]?.nickname ?? "玩家").join("、")}
                </p>
              )
            ) : (
              <p className="mb-3 text-sm leading-relaxed text-amber-100" role="status">
                第 {Math.min((plan?.played.length ?? 0) + 1, BATTLE_GAME_COUNT)} / {BATTLE_GAME_COUNT} 款已完成；
                全部完成後才會公布累積總排名。
              </p>
            )
          ) : (
            <>
              {winners.length > 0 && (
                <p className="mb-3 text-sm leading-relaxed text-yellow-200" role="status">
                  {teamVictory ? "獲勝隊伍" : winners.length > 1 ? "並列冠軍" : "本場冠軍"}：
                  {winners.map((id) => room.players[id]?.nickname ?? "玩家").join("、")}
                </p>
              )}
              {!winners.length && <p className="mb-3 text-sm text-white/65">本場尚無得分冠軍，再挑戰一次吧！</p>}
            </>
          )}
          {game && (
            <p className="text-sm text-white/50">
              <span aria-hidden="true">{game.icon}</span> {game.name}
              {elapsed !== null && <span> · 歷時 {formatTime(elapsed)}</span>}
            </p>
          )}
        </header>

        {showRankings && ranked.length > 0 && (
          <section className="mb-6 grid grid-cols-4 gap-2" aria-label={battleMode ? "決戰總成績" : "本局回顧"}>
            {(battleMode
              ? [
                  { value: String(BATTLE_GAME_COUNT), label: "完成遊戲" },
                  { value: String(ranked.length), label: "位玩家" },
                  { value: String(leader?.score ?? 0), label: "最高積分" },
                  { value: String(totalScore), label: "總積分" },
                ]
              : [
                  { value: String(ranked.length), label: "位玩家" },
                  { value: String(state?.totalRounds ?? "—"), label: "回合" },
                  { value: String(leader?.score ?? 0), label: "最高分" },
                  { value: String(totalScore), label: "總得分" },
                ]
            ).map((stat) => (
              <div key={stat.label} className="glass rounded-xl border border-white/10 p-3 text-center">
                <p className="text-lg font-bold tabular-nums">{stat.value}</p>
                <p className="text-[11px] text-white/50">{stat.label}</p>
              </div>
            ))}
          </section>
        )}

        {recap.length > 0 && (
          <section className="mb-6" aria-labelledby="recap-heading">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 id="recap-heading" className="text-sm font-semibold text-white/80">
                ✨ 本場花絮
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleCopyScores()}
                aria-label="複製戰報"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                {copiedScores ? "已複製戰報" : "複製戰報"}
              </Button>
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {recap.map((fact) => (
                <li
                  key={fact.id}
                  className="glass flex items-start gap-3 rounded-xl border border-white/10 p-3"
                >
                  <span className="text-2xl" aria-hidden="true">
                    {fact.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-cyan-200">{fact.title}</span>
                    <span className="block truncate text-sm text-white/80">{fact.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Podium Display */}
        {showRankings && ranked.length > 0 && winners.length > 0 && !teamVictory && (
          <section className="mb-8 flex h-48 items-end justify-center gap-3" aria-label="前三名領獎台">
            {podium.map(({ entry }) => {
              const place = rankOf(entry);
              const podiumStyles = [
                "h-20 w-24 border-yellow-500/30 bg-gradient-to-t from-yellow-500/20 to-yellow-500/5 shadow-lg",
                "h-14 w-20 border-white/10 bg-white/5 shadow",
                "h-10 w-20 border-white/10 bg-white/5 shadow",
              ];
              return (
                <div key={entry.id} className="flex flex-col items-center">
                  <p className="mb-1 text-2xl" aria-hidden="true">
                    {MEDALS[place]}
                  </p>
                  <p className={cn("mb-1", place === 0 ? "text-4xl animate-bounce" : "text-2xl")} aria-hidden="true">
                    {entry.avatar}
                  </p>
                  <p
                    className={cn(
                      "max-w-[100px] truncate text-center font-bold",
                      place === 0 ? "text-sm text-yellow-300" : "text-xs text-white/80",
                    )}
                  >
                    {entry.nickname}
                  </p>
                  <AnimatedScore
                    value={entry.score}
                    className={
                      place === 0 ? "text-yellow-400 font-extrabold" : place === 1 ? "text-cyan-400" : "text-orange-400"
                    }
                  />
                  <p
                    className={cn(
                      "flex items-end justify-center rounded-t-xl border pb-2 text-lg font-bold",
                      podiumStyles[place],
                    )}
                    aria-label={`第 ${place + 1} 名`}
                  >
                    <span aria-hidden="true">{place + 1}</span>
                  </p>
                </div>
              );
            })}
          </section>
        )}

        {/* Full Rankings */}
        {showRankings && ranked.length > 0 && (
          <section
            className="glass mb-6 rounded-2xl border border-white/10 p-4 shadow-lg"
            aria-labelledby="rankings-heading"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="rankings-heading" className="flex items-center gap-2 text-base font-semibold">
                <span aria-hidden="true">⭐</span> {battleMode ? "決戰總排行榜" : "完整排行榜"}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => void handleCopyScores()} className="text-xs">
                <Copy className="h-3.5 w-3.5 mr-1" />
                {copiedScores ? "已複製！" : "複製戰績榜"}
              </Button>
            </div>
            <ol className="space-y-2">
              {ranked.map((entry) => (
                <li
                  key={entry.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 transition-all",
                    entry.isMe ? "border-violet-500/40 bg-violet-500/15" : "border-white/5 bg-white/5",
                  )}
                >
                  <span className="w-6 text-sm font-bold tabular-nums text-white/40">#{rankOf(entry) + 1}</span>
                  <span className="text-2xl" aria-hidden="true">
                    {entry.avatar}
                  </span>
                  <span className="flex-1 text-sm font-semibold flex items-center gap-1.5">
                    {entry.nickname}
                    {entry.isHost && (
                      <span aria-label="房主" role="img">
                        👑
                      </span>
                    )}
                    {entry.isMe && <span className="text-[10px] text-violet-300 font-normal">（你）</span>}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-cyan-400">{entry.score} 分</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {showRankings && achievements.length > 0 && (
          <section
            className="glass mb-6 rounded-2xl border border-white/10 p-4 shadow-lg"
            aria-labelledby="achievements-heading"
          >
            <h2 id="achievements-heading" className="mb-3 text-base font-semibold">
              <span aria-hidden="true">🎖️</span> 本局專屬成就
            </h2>
            <ul className="grid grid-cols-2 gap-2">
              {achievements.map((a) => {
                const owner = room.players[a.playerId];
                return (
                  <li
                    key={`${a.id}-${a.playerId}`}
                    className="rounded-xl border border-white/5 bg-white/5 p-3 text-center"
                  >
                    <p className="mb-1 text-2xl" aria-hidden="true">
                      {a.icon}
                    </p>
                    <p className="text-xs font-bold text-white/80">{a.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-white/50">{owner?.nickname ?? ""}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Reaction Bar for celebrating */}
        {showRankings && (
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
            <p className="text-xs text-white/50 mb-2 flex items-center justify-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
              {battleMode ? "點擊表情為決戰冠軍喝采！" : "點擊表情為獲勝者喝采！"}
            </p>
            <div className="flex justify-center gap-2">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => void handleReaction(emoji)}
                  className="glass rounded-xl px-3 py-2 text-2xl transition-all hover:bg-white/15 active:scale-90"
                  aria-label={`發送 ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        <ErrorNote className="mb-4">{error}</ErrorNote>

        {/* Randomized party session: the drawn playlist and the roll into the next game. */}
        {plan && (
          <section className="mb-6" aria-labelledby="session-heading">
            <h2 id="session-heading" className="sr-only">
              {battleMode ? "決戰模式進度" : "隨機時段進度"}
            </h2>
            <SessionPlanPanel plan={plan} showSettings currentCompleted={room.status === "RESULTS"} />
            {battleMode ? (
              tournamentFinished ? (
                <div className="mt-3 rounded-2xl border border-yellow-400/30 bg-yellow-500/10 p-4">
                  <p className="mb-1 text-sm font-bold text-yellow-100">
                    🎉 8 款遊戲全部完成，決戰總排名已公布！
                  </p>
                  <p className="mb-1 text-xs leading-relaxed text-yellow-100/80">
                    總積分以各局原始分數直接相加。
                  </p>
                  <p className="mb-3 text-xs leading-relaxed text-yellow-100/80">
                    完整比賽：{tournamentGameIds.map((id) => GAMES.find((g) => g.id === id)?.name ?? id).join("、")}
                  </p>
                  {isHost && (
                    <Button
                      variant="accent"
                      size="md"
                      className="w-full font-bold"
                      onClick={() => {
                        setSessionMode("battle");
                        setShowSessionModal(true);
                      }}
                    >
                      <Dices className="h-4 w-4" aria-hidden="true" /> 再抽 8 款，開啟新決戰
                    </Button>
                  )}
                </div>
              ) : nextEntry ? (
                isHost ? (
                  <div className="mt-3 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4">
                    <p className="mb-1 flex items-center gap-2 text-sm font-bold text-white">
                      <span aria-hidden="true">{nextGame?.icon ?? "🎲"}</span>
                      下一局：{nextGame?.name ?? nextEntry.gameId}
                    </p>
                    <p className="mb-3 text-xs leading-relaxed text-cyan-100/80" role="status">
                      {autoCountdown === null
                        ? "自動前往已暫停，準備好再按下方按鈕。"
                        : `第 ${plan.played.length + 1} 款完成 · ${autoCountdown} 秒後前往下一款`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="accent"
                        size="md"
                        className="flex-1 font-bold"
                        loading={advancing}
                        onClick={() => void handleAdvance()}
                      >
                        <Play className="h-4 w-4" aria-hidden="true" /> 立刻前往下一款
                      </Button>
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={() => setAutoCountdown((seconds) => (seconds === null ? AUTO_ADVANCE_SECONDS : null))}
                      >
                        {autoCountdown === null ? (
                          <>
                            <Timer className="h-4 w-4" aria-hidden="true" /> 恢復自動
                          </>
                        ) : (
                          <>
                            <Pause className="h-4 w-4" aria-hidden="true" /> 先停一下
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-center text-sm text-white/60" role="status">
                    第 {plan.played.length + 1} / {BATTLE_GAME_COUNT} 款已完成；房主即將開始 {nextGame?.icon ?? "🎲"} {nextGame?.name ?? "下一款"}。
                    最終排名會在全部完成後揭曉。
                  </p>
                )
              ) : (
                <div className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4" role="status">
                  <p className="text-sm font-bold text-amber-100">第 8 款遊戲已完成，正在整理決戰總分…</p>
                  {isHost && (
                    <Button
                      variant="accent"
                      size="sm"
                      className="mt-3 w-full font-bold"
                      loading={finalizingBattle}
                      onClick={() => void finalizeBattle()}
                    >
                      {finalizingBattle ? "整理中…" : "公布最終排名"}
                    </Button>
                  )}
                </div>
              )
            ) : isHost ? (
              nextEntry ? (
                <div className="mt-3 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4">
                  <p className="mb-1 flex items-center gap-2 text-sm font-bold text-white">
                    <span aria-hidden="true">{nextGame?.icon ?? "🎲"}</span>
                    下一款：{nextGame?.name ?? nextEntry.gameId}
                    <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-white/70 tabular-nums">
                      約 {nextEntry.minutes} 分
                    </span>
                  </p>
                  <p className="mb-3 text-xs leading-relaxed text-cyan-100/80" role="status">
                    {autoCountdown === null
                      ? "自動前往已暫停，準備好再按下方按鈕。"
                      : `看完分數就出發 · ${autoCountdown} 秒後自動回到大廳`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="accent"
                      size="md"
                      className="flex-1 font-bold"
                      loading={advancing}
                      onClick={() => void handleAdvance()}
                    >
                      <Play className="h-4 w-4" aria-hidden="true" /> 立刻前往下一款
                    </Button>
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={() => setAutoCountdown((seconds) => (seconds === null ? AUTO_ADVANCE_SECONDS : null))}
                    >
                      {autoCountdown === null ? (
                        <>
                          <Timer className="h-4 w-4" aria-hidden="true" /> 恢復自動
                        </>
                      ) : (
                        <>
                          <Pause className="h-4 w-4" aria-hidden="true" /> 先停一下
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-yellow-400/30 bg-yellow-500/10 p-4">
                  <p className="mb-1 text-sm font-bold text-yellow-100">
                    🎉 這個時段的 {plan.played.length} 款遊戲都玩完了！
                  </p>
                  <p className="mb-3 text-xs leading-relaxed text-yellow-100/80">
                    玩過的：{plan.played.map((id) => GAMES.find((g) => g.id === id)?.name ?? id).join("、")}
                  </p>
                  <Button
                    variant="accent"
                    size="md"
                    className="w-full font-bold"
                    onClick={() => {
                      setSessionMode(plan.mode);
                      setShowSessionModal(true);
                    }}
                  >
                    <Dices className="h-4 w-4" aria-hidden="true" /> 再抽一個時段
                  </Button>
                </div>
              )
            ) : (
              <p className="mt-3 text-center text-sm text-white/60" role="status">
                {nextEntry
                  ? `房主即將開始下一款：${nextGame?.icon ?? "🎲"} ${nextGame?.name ?? ""}`
                  : "這個隨機時段結束了，等房主決定下一步…"}
              </p>
            )}
          </section>
        )}

        {/* Next-game straw poll — host still decides, but sees the room's mood. */}
        <section
          hidden={sessionActive}
          className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4"
          aria-labelledby="next-game-heading"
        >
          <h2 id="next-game-heading" className="mb-1 text-sm font-semibold text-white/85">
            下一局想玩什麼？
          </h2>
          <p className="mb-3 text-xs text-white/55">
            投一票給房主參考
            {topVoted ? ` · 目前最多：${topVoted.game.icon} ${topVoted.game.name}（${topVoted.count}）` : ""}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {playableGames.slice(0, 9).map((g) => {
              const count = Object.values(nextVotes).filter((id) => id === g.id).length;
              const selected = myNextVote === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => void handleVoteNext(g.id)}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition-all active:scale-95",
                    selected
                      ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100"
                      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
                  )}
                >
                  <span className="text-lg" aria-hidden="true">
                    {g.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{g.name}</span>
                  {count > 0 && <span className="tabular-nums text-white/50">{count}</span>}
                </button>
              );
            })}
          </div>
        </section>

        <div className="space-y-2.5">
          {isHost ? (
            <>
              <Button
                variant="accent"
                size="md"
                className="w-full font-bold shadow-lg"
                loading={restarting}
                onClick={async () => {
                  setRestarting(true);
                  try {
                    await rematch();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "無法重新開始");
                  } finally {
                    setRestarting(false);
                  }
                }}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> 再玩一次（回大廳）
              </Button>

              {topVoted && !sessionActive && (
                <Button
                  variant="ghost"
                  size="md"
                  className="w-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
                  onClick={() => void handleSwitchGame(topVoted.game.id)}
                >
                  <Gamepad2 className="h-4 w-4" aria-hidden="true" />
                  聽從投票：{topVoted.game.icon} {topVoted.game.name}
                </Button>
              )}

              <Button
                variant="ghost"
                size="md"
                className="w-full border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
                onClick={() => setShowSwitchModal(true)}
              >
                <Gamepad2 className="h-4 w-4" aria-hidden="true" /> 換一款遊戲（免重新掃碼）
              </Button>

              <Button
                variant="ghost"
                size="md"
                className="w-full border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
                onClick={() => setShowSessionModal(true)}
              >
                <Dices className="h-4 w-4" aria-hidden="true" />
                {sessionActive
                  ? "重抽隨機模式"
                  : battleMode
                    ? "⚔️ 再抽一場決戰"
                    : "🎲 抽一個隨機模式"}
              </Button>

              <Button variant="danger" size="md" className="w-full" onClick={() => setConfirmingEnd(true)}>
                結束並解散房間
              </Button>
            </>
          ) : (
            <>
              <p className="py-2 text-center text-sm text-white/60" role="status">
                <span className="mr-2 inline-block animate-pulse" aria-hidden="true">
                  ⏳
                </span>
                等待房主決定下一局…
              </p>
              <LinkButton href="/" variant="ghost" size="md" className="w-full">
                <Home className="h-4 w-4" aria-hidden="true" /> 返回首頁
              </LinkButton>
            </>
          )}
        </div>
      </div>

      {/* Randomized session draw */}
      <Modal
        open={showSessionModal}
        onClose={() => setShowSessionModal(false)}
        title="抽一個隨機派對模式"
      >
        <p className="mb-4 text-xs leading-relaxed text-white/55">
          選擇時間盒，或抽 8 款不同遊戲進行決戰。每款套用建議設定，玩完自動接下一款；決戰總排名只在八款全部完成後公布。
        </p>
        <PlayModePicker value={sessionMode} onChange={(next) => setSessionMode(next.id)} />
        {sessionMode === "battle" && sessionPlayerCount < BATTLE_MIN_PLAYERS && (
          <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-100" role="status">
            目前只有 {sessionPlayerCount} 位玩家，決戰模式至少需要 {BATTLE_MIN_PLAYERS} 人。
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" size="md" className="flex-1" onClick={() => setShowSessionModal(false)}>
            取消
          </Button>
          <Button
            variant="accent"
            size="md"
            className="flex-1 font-bold"
            loading={drawing}
            onClick={() => void handleDrawSession()}
          >
            <Dices className="h-4 w-4" aria-hidden="true" /> {sessionMode === "battle" ? "抽 8 款決戰遊戲" : "開始抽"}
          </Button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-white/40">
          {sessionMode === "battle"
            ? `決戰模式需至少 ${BATTLE_MIN_PLAYERS} 位玩家；抽新的清單會取代目前這份模式。`
            : `會優先避開這台裝置最近玩過的遊戲${sessionActive ? "；抽新的時段會取代目前這份清單" : ""}。`}
        </p>
      </Modal>

      {/* Switch Game Modal */}
      <Modal open={showSwitchModal} onClose={() => setShowSwitchModal(false)} title="換一款遊戲繼續同樂">
        <p className="mb-4 text-xs text-white/50">
          全體玩家將保留在房間中，直接轉換到新遊戲的大廳，無需重新輸入代碼或掃描 QR code！
        </p>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {playableGames.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => void handleSwitchGame(g.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-all hover:bg-white/15 hover:border-violet-400 active:scale-98"
            >
              <span className="text-3xl" aria-hidden="true">
                {g.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{g.name}</p>
                <p className="text-xs text-white/50 truncate">{g.description}</p>
              </div>
              <span className="text-xs text-violet-400 font-semibold shrink-0">切換 →</span>
            </button>
          ))}
        </div>
      </Modal>

      {/* End-room confirmation */}
      <Modal open={confirmingEnd} onClose={() => setConfirmingEnd(false)} title="要解散這間房嗎？" role="alertdialog">
        <p className="mb-6 text-sm text-white/50">所有玩家都會被移出，房間代碼立刻失效。這個動作無法復原。</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="md" className="flex-1" onClick={() => setConfirmingEnd(false)}>
            取消
          </Button>
          <Button variant="danger" size="md" className="flex-1" onClick={() => void handleEnd()}>
            解散房間
          </Button>
        </div>
      </Modal>
    </main>
  );
}
