import assert from "assert";

export interface BuildOutputArgsOptions {
  isGif?: boolean;
  fast?: boolean;
  fps: number;
  width: number;
  height: number;
  audioFilePath?: string;
  customOutputArgs?: string[];
}

/**
 * Build the ffmpeg encoder args for the output process. Returns
 * `customOutputArgs` verbatim when provided.
 */
export function buildOutputArgs({
  isGif,
  fast,
  fps,
  width,
  height,
  audioFilePath,
  customOutputArgs,
}: BuildOutputArgsOptions): string[] {
  if (customOutputArgs) {
    assert(Array.isArray(customOutputArgs), "customOutputArgs must be an array of arguments");
    return customOutputArgs;
  }

  // https://superuser.com/questions/556029/how-do-i-convert-a-video-to-gif-using-ffmpeg-with-reasonable-quality
  const videoOutputArgs = isGif
    ? [
        "-vf",
        `format=rgb24,fps=${fps},scale=${width}:${height}:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
        "-loop",
        "0",
      ]
    : [
        "-vf",
        "format=yuv420p",
        "-vcodec",
        "libx264",
        "-profile:v",
        "high",
        ...(fast ? ["-preset:v", "ultrafast"] : ["-preset:v", "medium"]),
        "-crf",
        "18",
        "-movflags",
        "faststart",
      ];

  const audioOutputArgs = audioFilePath ? ["-acodec", "aac", "-b:a", "128k"] : [];

  return [...audioOutputArgs, ...videoOutputArgs];
}
