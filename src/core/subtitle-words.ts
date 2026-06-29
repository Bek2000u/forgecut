import { easeOutExpo } from "../easings.js";
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

/** The word being spoken at `time`, with how long it has been on screen. */
export interface ActiveWord {
  word: SubtitleWord;
  /** Seconds since this word became active. */
  elapsed: number;
  /** Total on-screen duration of this word in seconds. */
  duration: number;
}

/**
 * Find the word active at `time` (seconds, relative to the layer start) for the
 * "single-word" karaoke style. Returns `null` between words (e.g. in a gap or
 * before the first / after the last word).
 */
export function activeWordAt(words: SubtitleWord[], time: number): ActiveWord | null {
  for (const word of words) {
    if (time >= word.start && time < word.end) {
      return { word, elapsed: time - word.start, duration: word.end - word.start };
    }
  }
  return null;
}

/** Visual transform for a popping-in word at a given point in its lifetime. */
export interface PopKeyframe {
  /** Scale multiplier applied to the word's font size. */
  scale: number;
  /** Opacity in [0, 1]. */
  opacity: number;
}

/**
 * Compute the pop-in transform for a single-word caption.
 *
 * The word eases from `popScale` to its full size (scale 1) and fades from
 * transparent to opaque over the first `popInDuration` seconds of its life,
 * then holds steady for the rest of its on-screen time.
 *
 * @param elapsed       seconds since the word became active
 * @param popInDuration length of the entrance animation in seconds
 * @param popScale      starting scale multiple (`<1` grows in, `>1` shrinks in)
 */
export function popKeyframe(elapsed: number, popInDuration: number, popScale: number): PopKeyframe {
  if (popInDuration <= 0) return { scale: 1, opacity: 1 };

  const t = Math.max(0, Math.min(elapsed / popInDuration, 1));
  const eased = easeOutExpo(t);
  return {
    scale: popScale + (1 - popScale) * eased,
    opacity: eased,
  };
}
