"use client";

import { useEffect, useRef } from "react";
import { useRoom } from "@/providers/RoomContext";
import { engineRoom } from "@/engine/participants";
import { requiredLinkChar } from "@/engine/wordChain";
import type { ChainGameState } from "@/engine/wordChain";
import { HostGameControls } from "@/components/game/HostGameControls";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Confetti } from "@/components/game/Confetti";
import { sfx } from "@/lib/sound";

export default function HostWordChain() {
  const { room } = useRoom();
  const state = room?.gameState as ChainGameState | undefined;
  const players = room ? engineRoom(room).players : {};

  // Buzz when an objection flips the room into voting; pop when a word lands.
  const lastPhase = useRef<string>("");
  const lastHead = useRef<string>("");
  const phase = state?.phase;
  const headWord = state?.headWord;
  useEffect(() => {
    if (phase === undefined || headWord === undefined) return;
    if (lastPhase.current && lastPhase.current !== "voting" && phase === "voting") sfx.playBuzzer();
    if (lastHead.current && lastHead.current !== headWord) sfx.playPop();
    lastPhase.current = phase;
    lastHead.current = headWord;
  }, [phase, headWord]);
  useEffect(() => {
    if (state?.phase === "result" && state.winnerId) sfx.playFanfare();
  }, [state?.phase, state?.winnerId]);

  if (!state) return null;
  const ids = Object.keys(players);
  const votes = Object.values(state.votes);
  const validVotes = votes.filter(Boolean).length;
  const invalidVotes = votes.length - validVotes;

  return (
    <HostShell>
      {state.phase === "result" && state.winnerId && <Confetti />}
      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <p className="mb-2 text-sm font-semibold tracking-wider text-emerald-300">
            文字接龍 🀄 · 第 {state.currentRound} / {state.totalRounds} 回合
          </p>

          {state.phase === "chaining" && (
            <>
              <h1 className="text-2xl font-bold text-white/70 md:text-3xl">
                用「<span className="text-4xl font-black text-emerald-300">{requiredLinkChar(state)}</span>」開頭接新詞
              </h1>
              <p
                className="mt-4 text-6xl font-black tracking-widest text-white md:text-8xl"
                aria-label={`接龍詞：${state.pending?.word ?? state.headWord}`}
              >
                {state.pending?.word ?? state.headWord}
              </p>
            </>
          )}

          {state.phase === "voting" && state.pending && (
            <>
              <h1 className="text-3xl font-black text-amber-300 md:text-5xl">異議！全場投票</h1>
              <p className="mt-4 text-2xl text-white/80">
                「<span className="text-4xl font-black text-amber-200">{state.pending.word}</span>」是有效接龍嗎？
              </p>
            </>
          )}

          {state.phase === "round_reveal" && (
            <h1 className="text-3xl font-black text-emerald-300 md:text-5xl">本回合結束！</h1>
          )}

          {state.phase === "result" && state.winnerId && (
            <h1 className="text-4xl font-black text-yellow-300 md:text-6xl">
              👑 {players[state.winnerId]?.nickname} 是接龍高手！
            </h1>
          )}
        </header>

        {state.phase === "voting" && (
          <div className="mx-auto mb-8 grid max-w-lg grid-cols-2 gap-4">
            <div className="rounded-3xl border border-emerald-400/40 bg-emerald-500/10 p-5">
              <p className="text-5xl font-black text-emerald-300">{validVotes}</p>
              <p className="mt-1 text-sm font-bold text-emerald-200">有效</p>
            </div>
            <div className="rounded-3xl border border-red-400/40 bg-red-500/10 p-5">
              <p className="text-5xl font-black text-red-300">{invalidVotes}</p>
              <p className="mt-1 text-sm font-bold text-red-200">無效</p>
            </div>
          </div>
        )}

        {state.phase === "chaining" && state.pending && (
          <div className="mx-auto mb-8 max-w-lg rounded-3xl border border-amber-400/40 bg-amber-500/10 p-5">
            <p className="text-sm font-bold text-amber-300">
              待確認：「{state.pending.word}」（{players[state.pending.playerId]?.nickname}）· 異議倒數{" "}
              {state.objectionWindow} 秒
            </p>
            {state.objectors.length > 0 && (
              <p className="mt-2 text-xs text-amber-200/80">
                已按異議：{state.objectors.map((id) => players[id]?.nickname).join("、")}
              </p>
            )}
          </div>
        )}

        {state.phase !== "result" && (
          <div className="mx-auto mb-6 max-w-xs">
            <RoundTimer
              timeLeft={state.timeLeft}
              total={state.phase === "voting" ? 4 : state.phase === "round_reveal" ? 3 : (room?.settings.timer ?? 20)}
              endLabel={state.phase === "voting" ? "投票截止" : "回合結束"}
              compact
            />
          </div>
        )}

        <div className="mx-auto mb-6 flex max-w-2xl flex-wrap justify-center gap-1.5" aria-label="接龍紀錄">
          {state.chain.slice(-8).map((word, i) => (
            <span key={`${i}-${word}`} className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-white/70">
              {word}
            </span>
          ))}
        </div>

        {state.feedback && (
          <p role="status" className="mb-4 text-lg text-emerald-200">
            {state.feedback}
          </p>
        )}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ids.map((id) => (
            <PlayerChip
              key={id}
              avatar={players[id].avatar}
              nickname={players[id].nickname}
              score={state.currentScores[id] ?? 0}
              highlight={state.pending?.playerId === id}
              status={state.pending?.playerId === id ? "新詞待確認" : undefined}
            />
          ))}
        </ul>
        <HostGameControls />
      </div>
    </HostShell>
  );
}
