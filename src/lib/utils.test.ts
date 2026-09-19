import { describe, expect, it } from "vitest";
import {
  cn,
  formatTime,
  generateRoomCode,
  getAvatarFromName,
  normalizeRoomCode,
  pickAvatar,
  sanitizeNickname,
} from "./utils";
import { AVATARS, ROOM_CODE_CHARS, ROOM_CODE_LENGTH } from "@/constants/room";

describe("utils", () => {
  describe("generateRoomCode", () => {
    it(`generates a code of length ${ROOM_CODE_LENGTH} using only allowed characters`, () => {
      const code = generateRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      for (const char of code) {
        expect(ROOM_CODE_CHARS).toContain(char);
      }
    });

    it("does not generate ambiguous characters (0, O, 1, I, L)", () => {
      for (let i = 0; i < 50; i++) {
        const code = generateRoomCode();
        expect(code).not.toMatch(/[0O1IL]/);
      }
    });
  });

  describe("normalizeRoomCode", () => {
    it("converts lowercase to uppercase and strips invalid characters", () => {
      expect(normalizeRoomCode("abcde")).toBe("ABCDE");
      expect(normalizeRoomCode("a-b c!2")).toBe("ABC2");
      expect(normalizeRoomCode("abcdefghi")).toHaveLength(ROOM_CODE_LENGTH);
    });
  });

  describe("sanitizeNickname", () => {
    it("trims whitespace and collapses multiple spaces", () => {
      expect(sanitizeNickname("  Alice   Bob  ")).toBe("Alice Bob");
    });

    it("strips invisible control characters", () => {
      expect(sanitizeNickname("Alice\u200B\u0000")).toBe("Alice");
    });

    it("truncates at maxLength", () => {
      const long = "A".repeat(30);
      expect(sanitizeNickname(long, 16)).toHaveLength(16);
    });
  });

  describe("pickAvatar", () => {
    it("picks an unused avatar when available", () => {
      const taken = [AVATARS[0]];
      const chosen = pickAvatar("Player", taken);
      expect(taken).not.toContain(chosen);
      expect(AVATARS).toContain(chosen);
    });

    it("falls back to deterministic name avatar when all are taken", () => {
      const allTaken = new Set(AVATARS);
      const chosen = pickAvatar("Alice", allTaken);
      expect(chosen).toBe(getAvatarFromName("Alice"));
    });
  });

  describe("formatTime", () => {
    it("formats seconds into mm:ss", () => {
      expect(formatTime(0)).toBe("0:00");
      expect(formatTime(9)).toBe("0:09");
      expect(formatTime(65)).toBe("1:05");
      expect(formatTime(125)).toBe("2:05");
    });
  });

  describe("cn", () => {
    it("joins class names ignoring falsy values", () => {
      expect(cn("a", false && "b", undefined, "c", null)).toBe("a c");
    });
  });
});
