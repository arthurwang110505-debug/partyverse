import type { Room } from "@/types";
import { connectedParticipantIds } from "@/engine/participants";

/** Only completion counts leave this helper, never votes, answers or roles. */
export function submissionProgress(room: Room, playerId?: string) {
  const state = room.gameState;
  let ids = connectedParticipantIds(room);
  let key: string | undefined;
  let prompt = "";
  if (
    state.phase === "voting" &&
    ["everybodyknows", "aibullshit", "fireworkmaster", "whoisundercoveragent", "wordchain"].includes(room.gameId)
  ) {
    key = "votes";
    prompt = "請在手機投票";
    if (room.gameId === "whoisundercoveragent") {
      const eliminated = (state.eliminatedPlayerIds ?? []) as string[];
      ids = ids.filter((id) => !eliminated.includes(id));
    }
    if (room.gameId === "wordchain") {
      const author = (state.pending as { playerId?: string } | null)?.playerId;
      ids = ids.filter((id) => id !== author);
    }
  } else if (room.gameId === "aibullshit" && state.phase === "submitting") {
    key = "doneIds";
    prompt = "寫下假答案（最多 2 個），寫完按「完成」";
  } else if (room.gameId === "fireworkmaster" && state.phase === "designing") {
    key = "designs";
    prompt = "設計完成後，記得送出作品";
  } else if (room.gameId === "song3seconds" && state.phase === "answering") {
    key = "playerAnswers";
    prompt = "看歌詞，在手機選歌名";
  }
  if (!key || ids.length === 0) return null;
  const submissions = (state[key] ?? {}) as Record<string, unknown>;
  const complete = (id: string) => submissions[id] !== undefined && submissions[id] !== null;
  return {
    completed: ids.filter(complete).length,
    total: ids.length,
    message:
      playerId && !ids.includes(playerId)
        ? "本輪觀戰，請看大螢幕"
        : playerId && complete(playerId)
          ? "已收到！等待其他玩家完成"
          : prompt,
  };
}
