import { describe, expect, it } from "vitest";
import type { Room, RoomSettings } from "@/types";
import { advanceRoomGame, applyRoomAction, startRoomGame } from "@/lib/gameSession";
import { testRoom } from "@/test/fixtures";
import { playableGameIds } from "./index";

/**
 * Full-match simulations: every game starts from a LOBBY and must reach
 * RESULTS with honest scores when its players behave. This is the headless
 * stand-in for a human playtest of all ten modes.
 */

interface Runner {
  room: Room;
  now: number;
  ticks: number;
  submit: (playerId: string, action: unknown) => void;
}

function expectedPhase(room: Room) {
  return {
    gameId: room.gameId,
    phase: room.gameState?.phase,
    round: room.gameState?.currentRound,
    startedAt: room.startedAt,
  };
}

/**
 * Play a whole match. `drive` runs before each 1s host tick and may submit
 * actions as any player through `runner.submit`. Returns the finished room
 * (status RESULTS).
 */
function playMatch(
  gameId: string,
  drive: (room: Room, runner: Runner) => void,
  options: { players?: number; settings?: Partial<RoomSettings>; maxSeconds?: number } = {},
): Room {
  const base = testRoom(gameId, options.players ?? 4);
  if (options.settings) {
    base.settings = { ...base.settings, ...options.settings };
  }
  const t0 = 1_700_000_000_000;
  const runner: Runner = { room: startRoomGame(base, t0), now: t0, ticks: 0, submit: () => {} };
  runner.submit = (playerId, action) => {
    runner.room = applyRoomAction(runner.room, playerId, action, expectedPhase(runner.room), runner.now);
  };
  const maxSeconds = options.maxSeconds ?? 600;
  for (let i = 0; i < maxSeconds && runner.room.status !== "RESULTS"; i++) {
    drive(runner.room, runner);
    runner.ticks += 1;
    runner.now += 1000;
    runner.room = advanceRoomGame(runner.room, runner.now);
  }
  expect(runner.room.status, `${gameId}: match did not finish within ${maxSeconds}s`).toBe("RESULTS");
  return runner.room;
}

function playerIds(room: Room): string[] {
  return Object.keys(room.players).filter((id) => room.players[id].role !== "display");
}

describe("full match playthroughs (all games reach results)", () => {
  it("everybodyknows: everyone votes each round until the final reveal", () => {
    const room = playMatch(
      "everybodyknows",
      (r, runner) => {
        const s = r.gameState as { phase: string; votes: Record<string, string> };
        if (s.phase !== "voting") return;
        for (const id of playerIds(r)) {
          if (!s.votes[id]) runner.submit(id, { type: "vote", targetPlayerId: playerIds(r)[0] });
        }
      },
      { settings: { rounds: 2 } },
    );
    const scores = (room.gameState as { currentScores: Record<string, number> }).currentScores;
    expect(Object.values(scores).some((v) => v > 0)).toBe(true);
  });

  it("aibullshit: bluffs, votes for the real answer, accumulates points", () => {
    const room = playMatch(
      "aibullshit",
      (r, runner) => {
        const s = r.gameState as {
          phase: string;
          submissions: Record<string, string>;
          votes: Record<string, string>;
        };
        for (const id of playerIds(r)) {
          if (s.phase === "submitting" && !s.submissions[id]) {
            runner.submit(id, { type: "submitBluff", text: `唬爛答案 ${id}` });
          }
          if (s.phase === "voting" && !s.votes[id]) {
            runner.submit(id, { type: "voteAnswer", optionId: "real" });
          }
        }
      },
      { settings: { rounds: 2 } },
    );
    const scores = (room.gameState as { currentScores: Record<string, number> }).currentScores;
    // All four voted for the real answer: everyone banked +10 per round.
    for (const id of playerIds(room)) expect(scores[id]).toBeGreaterThanOrEqual(20);
  });

  it("whoisundercoveragent: table outvotes the spy, civilians take the win", () => {
    const room = playMatch(
      "whoisundercoveragent",
      (r, runner) => {
        const s = r.gameState as { phase: string; votes: Record<string, string>; undercoverPlayerId: string };
        if (s.phase !== "voting") return;
        for (const id of playerIds(r)) {
          if (!s.votes[id]) runner.submit(id, { type: "vote", targetPlayerId: s.undercoverPlayerId });
        }
      },
      { maxSeconds: 300 },
    );
    expect((room.gameState as { winnerTeam: string }).winnerTeam).toBe("civilians");
    expect((room.gameState as { phase: string }).phase).toBe("result");
  });

  it("bombcountdown: bomb gets passed on correct answers until a round winner", () => {
    let passesSeen = 0;
    const room = playMatch(
      "bombcountdown",
      (r, runner) => {
        const s = r.gameState as {
          phase: string;
          challenge: { correctAnswer: string; id: string } | null;
          bombHolderId: string;
          passes: number;
        };
        if (s.phase !== "challenge" || !s.challenge) return;
        passesSeen = Math.max(passesSeen, s.passes);
        runner.submit(s.bombHolderId, {
          type: "answer",
          challengeId: s.challenge.id,
          answer: s.challenge.correctAnswer,
        });
      },
      { players: 3, settings: { rounds: 2, timer: 12 } },
    );
    expect(passesSeen).toBeGreaterThan(0);
    const scores = (room.gameState as { currentScores: Record<string, number> }).currentScores;
    expect(Math.max(...Object.values(scores))).toBeGreaterThanOrEqual(50); // a survivor got +50
  });

  it("song3seconds: correct answers score, rounds advance to the final result", () => {
    const room = playMatch(
      "song3seconds",
      (r, runner) => {
        const s = r.gameState as {
          phase: string;
          currentSong: { title: string };
          playerAnswers: Record<string, string>;
        };
        if (s.phase !== "answering") return;
        for (const id of playerIds(r)) {
          if (!s.playerAnswers[id]) runner.submit(id, { type: "answer", choice: s.currentSong.title });
        }
      },
      { settings: { rounds: 3 } },
    );
    const scores = (room.gameState as { currentScores: Record<string, number> }).currentScores;
    for (const id of playerIds(room)) expect(scores[id]).toBeGreaterThanOrEqual(30); // 3 rounds x 10+
  });

  it("kingtonight: tap, react and solve; a king is crowned each round", () => {
    const room = playMatch(
      "kingtonight",
      (r, runner) => {
        const s = r.gameState as {
          phase: string;
          challenge: { type: string; correctAnswer?: string };
          playerInputs: Record<string, number | string>;
        };
        if (s.phase !== "action") return;
        for (const id of playerIds(r)) {
          if (s.challenge.type === "tap_mash" && Number(s.playerInputs[id] ?? 0) < 5) {
            runner.submit(id, { type: "taps", count: 5 });
          }
          if (s.challenge.type === "reaction_tap" && s.playerInputs[id] === undefined) {
            runner.submit(id, { type: "react", reactionTimeMs: 150 });
          }
          if (s.challenge.type === "emoji_math" && s.playerInputs[id] === undefined) {
            runner.submit(id, { type: "choice", answer: s.challenge.correctAnswer });
          }
        }
      },
      { settings: { rounds: 3 } },
    );
    const scores = (room.gameState as { currentScores: Record<string, number> }).currentScores;
    expect(Math.max(...Object.values(scores))).toBeGreaterThanOrEqual(25);
  });

  it("fireworkmaster: designs, the show, then a vote winner", () => {
    const room = playMatch(
      "fireworkmaster",
      (r, runner) => {
        const s = r.gameState as {
          phase: string;
          designs: Record<string, unknown>;
          votes: Record<string, string>;
        };
        for (const id of playerIds(r)) {
          if (s.phase === "designing" && !s.designs[id]) {
            runner.submit(id, {
              type: "submitDesign",
              design: { color: "#ef4444", shape: "star", trailEffect: "glitter", density: 40 },
            });
          }
          if (s.phase === "voting" && !s.votes[id]) {
            const target = playerIds(r).find((other) => other !== id)!;
            runner.submit(id, { type: "voteDesign", targetPlayerId: target });
          }
        }
      },
      { settings: { timer: 25 } },
    );
    const s = room.gameState as { winnerId: string | null; currentScores: Record<string, number> };
    expect(s.winnerId).toBeTruthy();
    expect(s.currentScores[s.winnerId ?? ""]).toBeGreaterThan(0);
  });

  it("drawandguess: turns rotate through every drawer and guesses score", () => {
    let turnsSeen = 0;
    const room = playMatch(
      "drawandguess",
      (r, runner) => {
        const s = r.gameState as {
          phase: string;
          currentRound: number;
          drawerPlayerId: string;
          prompt: { word: string };
          guesses: Record<string, string>;
          strokes: unknown[];
          canvasVersion: number;
        };
        if (s.phase !== "drawing") return;
        turnsSeen = Math.max(turnsSeen, s.currentRound);
        const drawer = s.drawerPlayerId;
        if (s.strokes.length === 0) {
          runner.submit(drawer, {
            type: "addStroke",
            canvasVersion: s.canvasVersion,
            stroke: {
              id: `sim-${s.canvasVersion}`,
              revision: 1,
              color: "#ffffff",
              width: 6,
              points: [10, 10, 90, 90],
            },
          });
        }
        for (const id of playerIds(r)) {
          if (id === drawer || s.guesses[id]) continue;
          runner.submit(id, { type: "guessWord", word: s.prompt.word });
        }
      },
      { settings: { timer: 30, rounds: 1 } },
    );
    expect(turnsSeen).toBeGreaterThanOrEqual(4); // every one of the 4 players drew
    const scores = (room.gameState as { currentScores: Record<string, number> }).currentScores;
    expect(Math.max(...Object.values(scores))).toBeGreaterThan(0);
  });

  it("realbattle: players steer toward items and a champion emerges", () => {
    const room = playMatch(
      "realbattle",
      (r, runner) => {
        const s = r.gameState as {
          phase: string;
          positions: Record<string, { x: number; y: number }>;
          items: Array<{ x: number; y: number }>;
        };
        if (s.phase !== "battle") return;
        for (const id of playerIds(r)) {
          const pos = s.positions[id];
          if (!pos) continue;
          let best: { x: number; y: number } | null = null;
          let bestDist = Infinity;
          for (const item of s.items) {
            const d = Math.hypot(item.x - pos.x, item.y - pos.y);
            if (d < bestDist) {
              bestDist = d;
              best = item;
            }
          }
          if (!best) continue;
          const dx = Math.sign(best.x - pos.x) * (bestDist > 3 ? 1 : 0);
          const dy = Math.sign(best.y - pos.y) * (bestDist > 3 ? 1 : 0);
          if (dx === 0 && dy === 0) continue;
          runner.submit(id, { type: "move", dx, dy });
        }
      },
      { settings: { timer: 20 } },
    );
    const s = room.gameState as { winnerId: string | null; currentScores: Record<string, number> };
    expect(s.winnerId).toBeTruthy();
    expect(s.currentScores[s.winnerId ?? ""]).toBeGreaterThan(0);
  });

  it("mysteryroom: the table deduces the code, submits it and escapes", () => {
    const room = playMatch(
      "mysteryroom",
      (r, runner) => {
        const s = r.gameState as { phase: string; correctCode: string; submittedCode: string };
        if (s.phase !== "investigation") return;
        // "Discuss" for a few seconds, then the sharpest player types it in.
        if (runner.ticks > 5 && !s.submittedCode) {
          runner.submit("p1", { type: "submitCode", code: s.correctCode });
        }
      },
      { settings: { timer: 60 } },
    );
    expect((room.gameState as { isUnlocked: boolean }).isUnlocked).toBe(true);
    const scores = (room.gameState as { currentScores: Record<string, number> }).currentScores;
    expect(scores["p1"]).toBe(35); // 20 team + 15 finder
  });

  it("registers exactly the ten investigated games", () => {
    expect(playableGameIds().sort()).toEqual(
      [
        "aibullshit",
        "bombcountdown",
        "drawandguess",
        "everybodyknows",
        "fireworkmaster",
        "kingtonight",
        "mysteryroom",
        "realbattle",
        "song3seconds",
        "whoisundercoveragent",
      ].sort(),
    );
  });
});
