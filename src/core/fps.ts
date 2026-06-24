import { parseFps } from "../ffmpeg.js";

export interface ResolveFpsOptions {
  fast?: boolean;
  requestedFps?: number;
  isGif?: boolean;
  firstVideoFramerateStr?: string;
}

/**
 * Resolve the render framerate. `framerateStr` (used for the ffmpeg `fps`
 * filter) is always derived from the same numeric `fps` used to count frames,
 * so the two never drift (a mismatch made ffmpeg under/over-produce frames).
 */
export function resolveFps({
  fast,
  requestedFps,
  isGif,
  firstVideoFramerateStr,
}: ResolveFpsOptions): { fps: number; framerateStr: string } {
  if (fast) return { fps: 15, framerateStr: "15" };
  if (requestedFps && typeof requestedFps === "number") {
    return { fps: requestedFps, framerateStr: String(requestedFps) };
  }
  if (isGif) return { fps: 10, framerateStr: "10" };
  if (firstVideoFramerateStr) {
    const fps = parseFps(firstVideoFramerateStr) ?? 25;
    return { fps, framerateStr: String(fps) };
  }
  return { fps: 25, framerateStr: "25" };
}
