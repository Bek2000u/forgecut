import type { SubtitleWord } from "../types.js";

export interface WordRange {
  word: string;
  /** Inclusive start character offset into the joined caption. */
  startChar: number;
  /** Exclusive end character offset into the joined caption. */
  endChar: number;
  /** Whether this word is being spoken at the queried time. */
  active: boolean;
}

/** Join words into the caption string rendered on screen (space-separated). */
export function joinWords(words: SubtitleWord[]): string {
  return words.map((w) => w.word).join(" ");
}

/**
 * Compute the character range of each word within the joined caption and flag
 * which word is active at `time` (seconds, relative to the layer start). The
 * single joining space between words is accounted for in the offsets.
 */
export function computeWordRanges(words: SubtitleWord[], time: number): WordRange[] {
  const ranges: WordRange[] = [];
  let cursor = 0;
  for (const w of words) {
    const startChar = cursor;
    const endChar = cursor + w.word.length;
    ranges.push({
      word: w.word,
      startChar,
      endChar,
      active: time >= w.start && time < w.end,
    });
    cursor = endChar + 1; // +1 for the joining space
  }
  return ranges;
}
