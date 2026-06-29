import { describe, expect, test } from "vitest";
import {
  activeWordAt,
  computeWordRanges,
  joinWords,
  popKeyframe,
} from "../../src/core/subtitle-words.js";

const words = [
  { word: "Hello", start: 0, end: 1 },
  { word: "brave", start: 1, end: 2 },
  { word: "world", start: 2, end: 3 },
];

describe("subtitle-words", () => {
  test("joinWords joins with single spaces", () => {
    expect(joinWords(words)).toBe("Hello brave world");
  });

  test("computeWordRanges yields char offsets that account for spaces", () => {
    const ranges = computeWordRanges(words, 0);
    expect(ranges.map((r) => [r.startChar, r.endChar])).toEqual([
      [0, 5], // Hello
      [6, 11], // brave
      [12, 17], // world
    ]);
    // Offsets must line up with the rendered caption string.
    expect(joinWords(words).slice(6, 11)).toBe("brave");
  });

  test("marks exactly the spoken word active (start inclusive, end exclusive)", () => {
    expect(computeWordRanges(words, 1.5).find((r) => r.active)?.word).toBe("brave");
    expect(computeWordRanges(words, 1).find((r) => r.active)?.word).toBe("brave");
    expect(computeWordRanges(words, 2).find((r) => r.active)?.word).toBe("world");
  });

  test("no word is active before the first or after the last", () => {
    expect(computeWordRanges(words, -0.5).some((r) => r.active)).toBe(false);
    expect(computeWordRanges(words, 5).some((r) => r.active)).toBe(false);
  });

  describe("activeWordAt (single-word style)", () => {
    test("returns the spoken word with elapsed and duration", () => {
      const a = activeWordAt(words, 1.25);
      expect(a?.word.word).toBe("brave");
      expect(a?.elapsed).toBeCloseTo(0.25);
      expect(a?.duration).toBeCloseTo(1);
    });

    test("returns null in gaps and outside the caption", () => {
      expect(activeWordAt(words, -0.5)).toBeNull();
      expect(activeWordAt(words, 5)).toBeNull();
    });
  });

  describe("popKeyframe", () => {
    test("starts at popScale/transparent and ends at full size/opaque", () => {
      expect(popKeyframe(0, 0.15, 0.7)).toEqual({ scale: 0.7, opacity: 0 });
      const end = popKeyframe(0.15, 0.15, 0.7);
      expect(end.scale).toBeCloseTo(1);
      expect(end.opacity).toBeCloseTo(1);
    });

    test("holds at full size after the pop-in window", () => {
      expect(popKeyframe(2, 0.15, 0.7)).toEqual({ scale: 1, opacity: 1 });
    });

    test("disabling the animation (zero duration) is a no-op", () => {
      expect(popKeyframe(0, 0, 0.7)).toEqual({ scale: 1, opacity: 1 });
    });
  });
});
