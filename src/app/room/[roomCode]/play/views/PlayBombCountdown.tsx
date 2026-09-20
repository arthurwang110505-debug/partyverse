"use client";

import { useEffect, useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { BombGameState } from "@/engine/bombCountdown";
import { Button } from "@/components/ui/Button";
import { PlayShell } from "@/components/game/PlayShell";
import { RoundTimer } from "@/components/game/RoundTimer";
import { sfx, vibrate } from "@/lib/sound";

export default function PlayBombCountdown() {
  const { room, player, submitAction } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as BombGameState | undefined;
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [blocked, setBlocked] = useState(false);
  const answerAt = state?.lastAnswer?.at;
  const answerPlayer = state?.lastAnswer?.playerId;
  const answerCorrect = state?.lastAnswer?.correct;
  const myTurn = state?.phase === "challenge" && state.bombHolderId === player?.id;
  useEffect(() => {
    if (myTurn) vibrate([60, 30, 60]);
  }, [myTurn]);
  useEffect(() => {
    if (!answerAt || answerPlayer !== player?.id) return;
    setFeedback(answerCorrect ? "傳出成功！+10 分" : "答錯了！引信扣 1 秒，再試一次");
    if (answerCorrect) sfx.playSuccess();
    else sfx.playBuzzer();
    if (!answerCorrect) {
      setBlocked(true);
      const timer = setTimeout(() => setBlocked(false), 500);
      return () => {
        clearTimeout(timer);
        setBlocked(false);
      };
    }
  }, [answerAt, answerCorrect, answerPlayer, player?.id]);
  useEffect(() => {
    setFeedback("");
    setPending(false);
    setBlocked(false);
  }, [state?.currentRound, room?.startedAt]);
  if (!room || !player || !state) return null;
  const eliminated = state.eliminatedPlayers.includes(player.id);
  const answer = async (value: string) => {
    if (pending || blocked || !state.challenge || !myTurn) return;
    setPending(true);
    try {
      await submitAction({ type: "answer", answer: value, challengeId: state.challenge.id });
    } catch (error) {
      toast(error instanceof Error ? error.message : "送出失敗，請再試一次");
    } finally {
      setPending(false);
    }
  };
  return (
    <PlayShell round={`第 ${state.currentRound} / ${state.totalRounds} 局`}>
      <div className="space-y-5 pt-5">
        <RoundTimer
          timeLeft={state.bombTimeLeft}
          total={state.phase === "challenge" ? state.fuseDuration : state.phase === "round_reveal" ? 5 : 3}
          endLabel={state.phase === "challenge" ? "炸彈爆炸" : "下一階段"}
        />
        {state.phase === "briefing" ? (
          <section className="rounded-3xl border border-orange-400/30 bg-orange-500/10 p-6 text-center">
            <p className="mb-3 text-5xl" aria-hidden="true">
              💣
            </p>
            <h2 className="text-2xl font-black">全員回來，再戰一局！</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/75">
              答對 +10 分並傳出炸彈。引信不重置！
              <br />
              答錯扣 1 秒，最後倖存者 +50 分。
            </p>
          </section>
        ) : state.phase === "exploded" ? (
          <section className="py-8 text-center" role="status">
            <p className="mb-3 text-6xl" aria-hidden="true">
              💥
            </p>
            <h2 className="text-2xl font-bold text-orange-300">
              {state.lastEliminatedId === player.id
                ? "炸彈在你手上爆炸了！"
                : `${room.players[state.lastEliminatedId ?? ""]?.nickname ?? "玩家"} 本局出局`}
            </h2>
            <p className="mt-3 text-white/70">
              {eliminated ? "休息一下，下一局全員重新加入。" : "下一顆炸彈即將點燃…"}
            </p>
          </section>
        ) : state.phase === "round_reveal" ? (
          <section className="py-8 text-center" role="status">
            <p className="mb-3 text-5xl" aria-hidden="true">
              🏆
            </p>
            <h2 className="text-2xl font-black text-yellow-300">
              {state.roundWinnerId === player.id
                ? "你活到最後！+50 分"
                : state.roundWinnerId
                  ? `${room.players[state.roundWinnerId]?.nickname ?? "玩家"} 撐到最後！`
                  : "本局無人存活"}
            </h2>
            <p className="mt-3 text-white/65">
              {state.currentRound < state.totalRounds ? "下一局所有人回歸，積分繼續累加。" : "正在準備總積分結算…"}
            </p>
          </section>
        ) : eliminated ? (
          <section className="py-10 text-center">
            <h2 className="text-2xl font-bold">本局出局，下一局回歸</h2>
            <p className="mt-3 text-sm text-white/65">你的積分保留，看看誰能撐到最後！</p>
          </section>
        ) : myTurn && state.challenge ? (
          <section aria-labelledby="bomb-challenge">
            <p className="mb-2 text-center font-bold text-orange-300">輪到你！快傳出去！</p>
            <h2 id="bomb-challenge" className="mb-5 text-center text-2xl font-black">
              {state.challenge.question}
            </h2>
            <div className="space-y-3">
              {state.challenge.options.map((option) => (
                <Button
                  key={option}
                  variant="accent"
                  className="min-h-16 w-full text-xl"
                  disabled={pending || blocked}
                  onClick={() => void answer(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </section>
        ) : (
          <section className="py-8 text-center" role="status">
            <p className="mb-4 text-5xl" aria-hidden="true">
              {room.players[state.bombHolderId]?.avatar ?? "💣"}
            </p>
            <h2 className="text-xl font-bold">
              炸彈在 {room.players[state.bombHolderId]?.nickname ?? "其他玩家"} 手上
            </h2>
            <p className="mt-2 text-sm text-white/65">隨時可能傳給你，準備接招！</p>
          </section>
        )}
        {feedback && state.phase === "challenge" && (
          <p className="text-center text-sm font-bold text-amber-200" role="status">
            {feedback}
          </p>
        )}
        {state.phase === "challenge" && (
          <p className="text-center text-xs text-white/60">已傳 {state.passes} 次 · 傳遞不會重置引信</p>
        )}
      </div>
    </PlayShell>
  );
}
