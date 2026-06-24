import { describe, expect, test } from "vitest";
import { computeWordRanges, joinWords } from "../../src/core/subtitle-words.js";

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
});
