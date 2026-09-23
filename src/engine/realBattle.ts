import type { Achievement, GameEngine, GameSummary, Room } from "@/types";

export const BATTLE_GAME_ID = "realbattle";

export interface ArenaItem {
  id: string;
  x: number; // 0-100%
  y: number; // 0-100%
  type: "coin" | "star" | "mega";
  points: number;
}

/** Two characters closer than this get a body-check knockback. */
export const BUMP_DISTANCE = 6;
export const BUMP_KNOCKBACK = 3;

export interface PlayerPosition {
  x: number; // 0-100%
  y: number; // 0-100%
  score: number;
}

export type BattlePhase = "countdown" | "battle" | "result";

export interface BattleGameState {
  phase: BattlePhase;
  currentRound: number;
  timeLeft: number;
  positions: Record<string, PlayerPosition>;
  items: ArenaItem[];
  currentScores: Record<string, number>;
  winnerId: string | null;
}

export interface MoveAction {
  type: "move";
  dx: number; // -1 to 1
  dy: number; // -1 to 1
}

export type BattleAction = MoveAction;

function initialPositions(players: Room["players"]): Record<string, PlayerPosition> {
  const positions: Record<string, PlayerPosition> = {};
  const pIds = Object.keys(players);
  pIds.forEach((id, idx) => {
    const angle = (idx / pIds.length) * 2 * Math.PI;
    positions[id] = {
      x: 50 + Math.cos(angle) * 35,
      y: 50 + Math.sin(angle) * 35,
      score: 0,
    };
  });
  return positions;
}

function spawnItems(): ArenaItem[] {
  const items: ArenaItem[] = [];
  for (let i = 0; i < 8; i++) {
    items.push({
      id: `item_${i}_${Date.now()}`,
      x: 15 + Math.random() * 70,
      y: 15 + Math.random() * 70,
      type: i % 3 === 0 ? "star" : "coin",
      points: i % 3 === 0 ? 5 : 2,
    });
  }
  return items;
}

export const RealBattleEngine: GameEngine<BattleGameState> = {
  createGame(room) {
    const pos = initialPositions(room.players);
    const scores: Record<string, number> = {};
    for (const id of Object.keys(room.players)) scores[id] = 0;

    return {
      phase: "countdown",
      currentRound: 1,
      timeLeft: 3, // 3s countdown
      positions: pos,
      items: spawnItems(),
      currentScores: scores,
      winnerId: null,
    };
  },

  startGame(room) {
    return this.createGame(room);
  },

  handlePlayerAction(room, playerId, action) {
    const state = room.gameState;
    if (!state || state.phase !== "battle") return state;

    const act = action as MoveAction;
    if (
      act?.type !== "move" ||
      typeof act.dx !== "number" ||
      typeof act.dy !== "number" ||
      !Number.isFinite(act.dx) ||
      !Number.isFinite(act.dy) ||
      Math.abs(act.dx) > 1 ||
      Math.abs(act.dy) > 1
    )
      return state;

    const cur = state.positions[playerId];
    if (!cur) return state;

    // Apply movement
    const step = 6; // movement speed %
    const newX = Math.max(5, Math.min(95, cur.x + act.dx * step));
    const newY = Math.max(5, Math.min(95, cur.y + act.dy * step));

    const nextPositions = {
      ...state.positions,
      [playerId]: { ...cur, x: newX, y: newY },
    };

    // Body check: ramming an opponent knocks them back, so you can muscle
    // your way to a coin. The mover's own position is unaffected.
    for (const [otherId, other] of Object.entries(nextPositions)) {
      if (otherId === playerId) continue;
      const dist = Math.hypot(newX - other.x, newY - other.y);
      if (dist >= BUMP_DISTANCE) continue;
      const angle = dist === 0 ? Math.random() * Math.PI * 2 : Math.atan2(other.y - newY, other.x - newX);
      nextPositions[otherId] = {
        ...other,
        x: Math.max(5, Math.min(95, other.x + Math.cos(angle) * BUMP_KNOCKBACK)),
        y: Math.max(5, Math.min(95, other.y + Math.sin(angle) * BUMP_KNOCKBACK)),
      };
    }

    // Check collision with items
    let itemCollected = false;
    let earned = 0;
    const remainingItems = state.items.filter((item) => {
      const dist = Math.hypot(newX - item.x, newY - item.y);
      if (dist < 8) {
        itemCollected = true;
        earned += item.points;
        return false;
      }
      return true;
    });

    const nextScores = { ...state.currentScores };
    if (itemCollected) {
      nextScores[playerId] = (nextScores[playerId] ?? 0) + earned;
      nextPositions[playerId] = { ...nextPositions[playerId], score: nextScores[playerId] };
    }

    // Respawn items if low
    const finalItems = remainingItems.length < 3 ? [...remainingItems, ...spawnItems()] : remainingItems;

    return {
      ...state,
      positions: nextPositions,
      items: finalItems,
      currentScores: nextScores,
    };
  },

  updateGameState(room) {
    const state = room.gameState;
    if (!state) return state;

    if (state.phase === "countdown") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        return {
          ...state,
          phase: "battle",
          timeLeft: Math.max(20, room.settings?.timer ?? 25),
        };
      }
      return { ...state, timeLeft: nextTime };
    }

    if (state.phase === "battle") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        const scores = state.currentScores;
        const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        return {
          ...state,
          phase: "result",
          winnerId: entries[0]?.[0] ?? null,
          timeLeft: 0,
        };
      }
      // Every 8 seconds a 10-point mega star drops and the table scrambles.
      let items = state.items;
      if (nextTime % 8 === 0) {
        const id = `mega_${nextTime}`;
        if (!items.some((item) => item.id === id)) {
          items = [
            ...items,
            {
              id,
              x: 10 + Math.random() * 80,
              y: 10 + Math.random() * 80,
              type: "mega",
              points: 10,
            },
          ];
        }
      }
      return { ...state, timeLeft: nextTime, items };
    }

    return state;
  },

  endRound(room) {
    return this.createGame(room);
  },

  endGame(room): GameSummary {
    const state = room.gameState;
    const scores = state?.currentScores ?? {};
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const winnerId = state?.winnerId ?? entries[0]?.[0] ?? "";

    const achievements: Achievement[] = [];
    if (winnerId) {
      achievements.push({
        id: "battle_champion",
        name: "亂鬥之王",
        icon: "⚔️",
        description: "在激烈的戰場搶奪中席捲全場星星",
        playerId: winnerId,
      });
    }

    return { scores, achievements, winnerId };
  },

  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};
