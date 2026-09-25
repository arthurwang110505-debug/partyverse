/** RTDB removes empty arrays, empty maps, and nulls on a write/read round trip. */
const COLLECTIONS: Record<string, { arrays: string[]; maps: string[] }> = {
  bombcountdown: { arrays: ["eliminatedPlayers"], maps: ["correctAnswers", "roundWins"] },
  everybodyknows: { arrays: ["mostVotedPlayerIds"], maps: ["votes", "voteCounts"] },
  aibullshit: { arrays: ["options", "usedPromptIds"], maps: ["submissions", "votes", "doneIds"] },
  whoisundercoveragent: { arrays: ["eliminatedPlayerIds"], maps: ["playerWords", "votes"] },
  song3seconds: { arrays: ["songOrder", "usedPromptIds"], maps: ["playerAnswers", "answerTimes"] },
  kingtonight: { arrays: ["challengeOrder"], maps: ["playerInputs"] },
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
  brainteaser: { arrays: ["options", "riddleOrder", "usedPromptIds"], maps: ["answers", "roundPoints"] },
  amongus: {
    arrays: ["impostorIds", "deadIds", "bodies", "meetingBodies"],
    maps: ["tasks", "taskMask", "killCooldowns", "emergencyUsed", "votes"],
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
  for (const key of [...collections.maps, "currentScores", "rulesReady"]) {
    if (!state[key] || typeof state[key] !== "object" || Array.isArray(state[key])) state[key] = {};
  }
  state.winnerId ??= null;
  if (gameId === "drawandguess") {
    state.strokes = (state.strokes as unknown[])
      .filter((stroke) => stroke && typeof stroke === "object")
      .map((stroke) => ({ ...(stroke as object), points: arrayValue((stroke as { points?: unknown }).points) }));
    state.canvasVersion ??= 0;
  }
  if (gameId === "amongus") {
    state.tasks = Object.fromEntries(
      Object.entries(state.tasks as Record<string, unknown>).map(([id, list]) => [id, arrayValue(list)]),
    );
  }
  if (gameId === "fireworkmaster") {
    // Nested stroke arrays can come back as index-keyed objects.
    state.designs = Object.fromEntries(
      Object.entries(state.designs as Record<string, unknown>).map(([id, d]) => [
        id,
        {
          strokes: arrayValue((d as { strokes?: unknown })?.strokes).map((st) => ({
            ...(st as object),
            p: arrayValue((st as { p?: unknown })?.p),
          })),
        },
      ]),
    );
  }
  if (gameId === "whackmoles") {
    state.spawns = (state.spawns as unknown[]).filter((s) => s && typeof s === "object");
  }
  return state;
}
