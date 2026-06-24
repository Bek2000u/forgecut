import assert from "assert";
import type { ProcessedClip } from "../parseConfig.js";
import { multipleOf2 } from "../util.js";

export interface FirstVideoInfo {
  width?: number;
  height?: number;
  framerateStr?: string;
}

/**
 * Find the first video layer across all clips, used to derive default output
 * dimensions and framerate when the caller doesn't specify them.
 */
export function detectFirstVideo(clips: ProcessedClip[]): FirstVideoInfo {
  for (const clip of clips) {
    if (!clip) continue;
    for (const layer of clip.layers) {
      if (layer.type === "video") {
        return {
          width: layer.inputWidth,
          height: layer.inputHeight,
          framerateStr: layer.framerateStr,
        };
      }
    }
  }
  return {};
}

export interface ResolveDimensionsOptions {
  requestedWidth?: number;
  requestedHeight?: number;
  isGif?: boolean;
  fast?: boolean;
  firstVideoWidth?: number;
  firstVideoHeight?: number;
}

/**
 * Resolve the output width/height from the (optional) requested size, the first
 * video's size, GIF defaults, and fast-preview downscaling.
 */
export function resolveDimensions({
  requestedWidth,
  requestedHeight,
  isGif,
  fast,
  firstVideoWidth,
  firstVideoHeight,
}: ResolveDimensionsOptions): { width: number; height: number } {
  let width: number;
  let height: number;

  let desiredWidth;
  if (requestedWidth) desiredWidth = requestedWidth;
  else if (isGif) desiredWidth = 320;

  const roundDimension = (val: number) => (isGif ? Math.round(val) : multipleOf2(val));

  if (firstVideoWidth && firstVideoHeight) {
    if (desiredWidth) {
      const calculatedHeight = (firstVideoHeight / firstVideoWidth) * desiredWidth;
      height = roundDimension(calculatedHeight);
      width = desiredWidth;
    } else {
      width = firstVideoWidth;
      height = firstVideoHeight;
    }
  } else if (desiredWidth) {
    width = desiredWidth;
    height = desiredWidth;
  } else {
    // No video
    width = 640;
    height = 640;
  }

  // User override?
  if (requestedWidth && requestedHeight) {
    width = requestedWidth;
    height = requestedHeight;
  }

  if (fast) {
    const numPixelsEachDirection = 250;
    const aspectRatio = width / height;
    width = roundDimension(numPixelsEachDirection * Math.sqrt(aspectRatio));
    height = roundDimension(numPixelsEachDirection * Math.sqrt(1 / aspectRatio));
  }

  assert(width, "Width not specified or detected");
  assert(height, "Height not specified or detected");

  if (!isGif) {
    // x264 requires multiple of 2, eg minimum 2
    width = Math.max(2, width);
    height = Math.max(2, height);
  }

  return { width, height };
}
