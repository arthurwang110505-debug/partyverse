/** RTDB removes empty arrays, empty maps, and nulls on a write/read round trip. */
const COLLECTIONS: Record<string, { arrays: string[]; maps: string[] }> = {
  bombcountdown: { arrays: ["eliminatedPlayers"], maps: ["correctAnswers", "roundWins"] },
  everybodyknows: { arrays: ["mostVotedPlayerIds"], maps: ["votes", "voteCounts"] },
  aibullshit: { arrays: ["options", "usedPromptIds"], maps: ["submissions", "votes"] },
  whoisundercoveragent: { arrays: ["eliminatedPlayerIds"], maps: ["playerWords", "votes"] },
  song3seconds: { arrays: [], maps: ["playerAnswers", "answerTimes"] },
  kingtonight: { arrays: [], maps: ["playerInputs"] },
  fireworkmaster: { arrays: [], maps: ["designs", "votes", "voteCounts"] },
  drawandguess: {
    arrays: ["strokes", "correctPlayerIds", "drawerOrder", "usedPromptIds"],
    maps: ["guesses", "roundScores"],
  },
  realbattle: { arrays: ["items"], maps: ["positions"] },
  mysteryroom: { arrays: [], maps: ["playerClues"] },
  musicalchairs: { arrays: ["survivors", "eliminatedPlayerIds"], maps: ["sitOrder"] },
  whackmoles: { arrays: ["spawns"], maps: ["hits", "misses", "streaks", "totalHits"] },
  simonsays: { arrays: ["outThisRound", "maxedOut"], maps: ["playerProgress"] },
  wordchain: { arrays: ["chain", "objectors"], maps: ["votes"] },
  pokerlite: {
    arrays: ["seats", "deck", "board", "activePlayers", "foldedIds", "allInIds", "handWinnerIds"],
    maps: ["holeCards", "chips", "committed", "streetCommitted", "toCall", "streetActed", "showdownHands", "potSplit"],
  },
};
export function arrayValue(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.filter((item) => item != null);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .filter((key) => /^\d+$/.test(key))
      .sort((a, b) => +a - +b)
      .map((key) => (value as Record<string, unknown>)[key]);
  }
  return [];
}
export function normalizeGameState(gameId: string, value: unknown): Record<string, unknown> {
  const state =
    value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
  if (!state.phase) return state; // An empty lobby is not a started game.
  const collections = COLLECTIONS[gameId] ?? { arrays: [], maps: [] };
  for (const key of [...collections.arrays, "achievements", "winnerIds"]) state[key] = arrayValue(state[key]);
  for (const key of [...collections.maps, "currentScores"]) {
    if (!state[key] || typeof state[key] !== "object" || Array.isArray(state[key])) state[key] = {};
  }
  state.winnerId ??= null;
  if (gameId === "drawandguess") {
    state.strokes = (state.strokes as unknown[])
      .filter((stroke) => stroke && typeof stroke === "object")
      .map((stroke) => ({ ...(stroke as object), points: arrayValue((stroke as { points?: unknown }).points) }));
    state.canvasVersion ??= 0;
  }
  return state;
}
