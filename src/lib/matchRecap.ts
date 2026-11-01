import type { Room } from "@/types";
import { participantIds } from "@/engine/participants";

export interface RecapFact {
  id: string;
  icon: string;
  title: string;
  detail: string;
}

/**
 * Build a short "fun facts" strip for the results screen.
 * Uses only public score maps — never roles or secret words.
 */
export function buildMatchRecap(room: Room): RecapFact[] {
  const ids = participantIds(room);
  if (ids.length === 0) return [];

  const state = room.gameState as {
    currentScores?: Record<string, number>;
    roundScores?: Record<string, number>;
    winnerIds?: string[];
    winnerId?: string | null;
    winnerTeam?: string | null;
    totalRounds?: number;
    achievements?: Array<{ id: string; name: string; icon: string; playerId: string }>;
  };

  const scores = state.currentScores ?? {};
  const facts: RecapFact[] = [];

  const ranked = ids
    .map((id) => ({ id, score: scores[id] ?? 0, name: room.players[id]?.nickname ?? "玩家" }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];
  if (top && top.score > 0) {
    facts.push({
      id: "mvp",
      icon: "👑",
      title: "本場 MVP",
      detail: `${top.name} · ${top.score} 分`,
    });
  }

  if (ranked.length >= 2 && top && bottom && top.score - bottom.score >= 15) {
    facts.push({
      id: "gap",
      icon: "📏",
      title: "分差最大",
      detail: `${top.name} 領先 ${top.score - bottom.score} 分`,
    });
  }

  // Closest duel: two players within 5 points of each other near the top.
  if (ranked.length >= 2) {
    let tight: { a: string; b: string; gap: number } | null = null;
    for (let i = 0; i < ranked.length - 1; i++) {
      const gap = ranked[i].score - ranked[i + 1].score;
      if (gap <= 5 && ranked[i].score > 0 && (!tight || gap < tight.gap)) {
        tight = { a: ranked[i].name, b: ranked[i + 1].name, gap };
      }
    }
    if (tight) {
      facts.push({
        id: "duel",
        icon: "⚔️",
        title: tight.gap === 0 ? "並列激戰" : "險勝一刻",
        detail:
          tight.gap === 0
            ? `${tight.a} 與 ${tight.b} 同分`
            : `${tight.a} 只差 ${tight.b} ${tight.gap} 分`,
      });
    }
  }

  const positive = ranked.filter((r) => r.score > 0);
  if (positive.length === ids.length && ids.length >= 3) {
    facts.push({
      id: "everyone",
      icon: "🎉",
      title: "全員上分",
      detail: "每一個人都拿到分數！",
    });
  } else if (positive.length === 1 && top) {
    facts.push({
      id: "solo",
      icon: "🌟",
      title: "一人獨秀",
      detail: `整場只有 ${top.name} 得分`,
    });
  }

  const elapsed =
    room.startedAt != null
      ? Math.max(0, Math.round(((room.finishedAt ?? Date.now()) - room.startedAt) / 1000))
      : null;
  if (elapsed != null && elapsed > 0) {
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    facts.push({
      id: "time",
      icon: "⏱️",
      title: "本場時長",
      detail: m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`,
    });
  }

  for (const a of (state.achievements ?? []).slice(0, 2)) {
    const owner = room.players[a.playerId]?.nickname ?? "玩家";
    facts.push({
      id: `ach-${a.id}-${a.playerId}`,
      icon: a.icon || "🎖️",
      title: a.name,
      detail: owner,
    });
  }

  // Cap so the strip stays scannable on a phone.
  return facts.slice(0, 4);
}

/** Plain-text night report for clipboard share (LINE / IG). */
export function formatMatchReport(room: Room, gameName: string): string {
  const ids = participantIds(room);
  const scores = (room.gameState as { currentScores?: Record<string, number> }).currentScores ?? {};
  const ranked = ids
    .map((id) => ({
      name: room.players[id]?.nickname ?? "玩家",
      avatar: room.players[id]?.avatar ?? "",
      score: scores[id] ?? 0,
    }))
    .sort((a, b) => b.score - a.score);

  const medals = ["🥇", "🥈", "🥉"];
  const lines = [
    `🏆 PARTYVERSE 戰報 · ${gameName}`,
    `房間 ${room.id}`,
    "------------------------",
    ...ranked.map(
      (r, i) => `${medals[i] ?? `#${i + 1}`} ${r.avatar} ${r.name}：${r.score} 分`,
    ),
  ];

  const facts = buildMatchRecap(room);
  if (facts.length) {
    lines.push("------------------------");
    for (const f of facts) lines.push(`${f.icon} ${f.title}：${f.detail}`);
  }
  lines.push("------------------------", "一起玩 → https://partyverse-xi.vercel.app/");
  return lines.join("\n");
}
