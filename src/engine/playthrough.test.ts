import { describe, expect, it, vi } from "vitest";
import type { Room, RoomSettings } from "@/types";
import { advanceRoomGame, applyRoomAction, startRoomGame } from "@/lib/gameSession";
import { testRoom } from "@/test/fixtures";
import { playableGameIds } from "./index";
import { simonSequence } from "./simonSays";

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

  it("musicalchairs: slowest tapper falls each round, last stand wins", () => {
    const room = playMatch(
      "musicalchairs",
      (r, runner) => {
        const s = r.gameState as { phase: string; survivors: string[]; sitOrder: Record<string, number> };
        if (s.phase !== "sit") return;
        for (const id of playerIds(r)) {
          if (s.survivors.includes(id) && s.sitOrder[id] === undefined) runner.submit(id, { type: "sit" });
        }
      },
    );
    const s = room.gameState as { lastStandId: string | null; currentScores: Record<string, number> };
    // p1-p4 tap in seat order, so p4, p3, p2 fall in turn and p1 stays.
    expect(s.lastStandId).toBe("p1");
    expect(s.currentScores["p1"]).toBe(70); // +10, +10, +50
    expect(s.currentScores["p4"]).toBe(0);
  });

  it("whackmoles: players whack the active mole and the best hand wins", () => {
    // The mole windows live on the wall clock, so run this match on fake
    // time that advances in lock-step with the host ticks.
    const realNow = Date.now();
    vi.useFakeTimers().setSystemTime(realNow);
    try {
      const room = playMatch(
        "whackmoles",
        (r, runner) => {
          // Keep the (frozen) wall clock in lock-step with the host ticks so
          // the engine's Date.now()-based spawn windows line up.
          vi.setSystemTime(runner.now);
          const s = r.gameState as {
            phase: string;
            spawns: Array<{ cell: number; startAt: number; endAt: number; hitBy: string[] }>;
            hits: Record<string, number>;
          };
          if (s.phase !== "hunting") return;
          const now = runner.now;
          const spawn = s.spawns.find((sp) => now >= sp.startAt && now < sp.endAt && sp.hitBy.length === 0);
          if (!spawn) return;
          const whacker = playerIds(r).find((id) => (s.hits[id] ?? 0) < 5) ?? playerIds(r)[0];
          runner.submit(whacker, { type: "whack", cell: spawn.cell });
        },
        { settings: { rounds: 2 } },
      );
      const scores = (room.gameState as { currentScores: Record<string, number>; winnerId: string | null }).currentScores;
      const winner = (room.gameState as { winnerId: string | null }).winnerId;
      expect(Math.max(...Object.values(scores))).toBeGreaterThan(0);
      expect(winner).toBeTruthy();
      expect(scores[winner ?? ""]).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("simonsays: everyone repeats the sequence, levels grow, a brain wins", () => {
    const room = playMatch(
      "simonsays",
      (r, runner) => {
        const s = r.gameState as {
          phase: string;
          seqSeed: number;
          level: number;
          playerProgress: Record<string, number>;
          outThisRound: string[];
        };
        if (s.phase !== "repeat") return;
        const seq = simonSequence(s.seqSeed, s.level);
        for (const id of playerIds(r)) {
          if (s.outThisRound.includes(id)) continue;
          runner.submit(id, { type: "tap", quadrant: seq[s.playerProgress[id] ?? 0] });
        }
      },
      { settings: { rounds: 2 } },
    );
    const scores = (room.gameState as { currentScores: Record<string, number> }).currentScores;
    // Each player at least completed level 3 in both rounds: 3+3 points minimum.
    for (const id of playerIds(room)) expect(scores[id]).toBeGreaterThanOrEqual(6);
  });

  it("wordchain: links score, an objection is upheld, rounds roll on", () => {
    let objected = false;
    const room = playMatch(
      "wordchain",
      (r, runner) => {
        const s = r.gameState as {
          phase: string;
          requiredChar: string;
          chain: string[];
          pending: { playerId: string; word: string } | null;
          objectors: string[];
          votes: Record<string, boolean>;
          currentRound: number;
        };
        if (s.phase === "chaining") {
          const word = s.requiredChar + String.fromCharCode(0x4e00 + ((runner.ticks * 131) % 20000));
          if (!s.chain.includes(word)) runner.submit("p1", { type: "submitWord", word });
          if (!objected && s.currentRound === 1 && s.pending?.playerId === "p1") {
            objected = true;
            runner.submit("p2", { type: "object" });
          }
          return;
        }
        if (s.phase === "voting" && s.pending) {
          for (const id of playerIds(r)) {
            if (id === s.pending.playerId || s.votes[id] !== undefined) continue;
            runner.submit(id, { type: "voteWord", valid: false }); // the table overrules
          }
        }
      },
      { settings: { rounds: 3, timer: 12 } },
    );
    const s = room.gameState as { currentScores: Record<string, number>; winnerId: string | null };
    expect(s.currentScores["p1"]).toBeGreaterThan(10); // many confirmed links
    expect(s.currentScores["p2"]).toBe(5); // the upheld objection
    expect(s.winnerId).toBeTruthy();
  });

  it("pokerlite: a full hand cycle of bets, showdown and chip carry-over", () => {
    let lastHand = 0;
    let p3Raised = false;
    const room = playMatch(
      "pokerlite",
      (r, runner) => {
        const s = r.gameState as {
          phase: string;
          handNumber: number;
          toAct: string | null;
          toCall: Record<string, number>;
          currentBet: number;
          chips: Record<string, number>;
        };
        if (s.phase !== "betting" || !s.toAct) return;
        if (s.handNumber !== lastHand) {
          lastHand = s.handNumber;
          p3Raised = false;
        }
        const id = s.toAct;
        if ((s.toCall[id] ?? 0) > 0) {
          runner.submit(id, { type: "call" });
        } else if (id === "p3" && !p3Raised) {
          p3Raised = true;
          runner.submit(id, { type: "raise", to: s.currentBet + 2 + 4 });
        } else {
          runner.submit(id, { type: "check" });
        }
      },
      { settings: { rounds: 3 } },
    );
    const s = room.gameState as { chips: Record<string, number>; winnerId: string | null };
    for (const id of playerIds(room)) expect(s.chips[id] ?? 0).toBeGreaterThanOrEqual(0);
    expect(Object.values(s.chips).some((c) => c > 100)).toBe(true); // someone banked a pot
    expect(s.winnerId).toBeTruthy();
  });

  it("registers exactly the fifteen games", () => {
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
        "musicalchairs",
        "whackmoles",
        "simonsays",
        "wordchain",
        "pokerlite",
      ].sort(),
    );
  });
});
