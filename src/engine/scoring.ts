export function topScorers(scores: Record<string, number>, ids = Object.keys(scores)): string[] {
  const max = Math.max(0, ...ids.map((id) => scores[id] ?? 0));
  return max > 0 ? ids.filter((id) => scores[id] === max) : [];
}
