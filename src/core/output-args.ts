import assert from "assert";

export interface BuildOutputArgsOptions {
  isGif?: boolean;
  fast?: boolean;
  fps: number;
  width: number;
  height: number;
  audioFilePath?: string;
  customOutputArgs?: string[];
  videoCodec?: string;
  preset?: string;
  crf?: number;
  videoBitrate?: string;
}

/**
 * Build the ffmpeg encoder args for the output process. Returns
 * `customOutputArgs` verbatim when provided; otherwise builds h264 (or the
 * requested `videoCodec`, e.g. `h264_nvenc`) args from preset/crf/bitrate.
 */
export function buildOutputArgs({
  isGif,
  fast,
  fps,
  width,
  height,
  audioFilePath,
  customOutputArgs,
  videoCodec,
  preset,
  crf,
  videoBitrate,
}: BuildOutputArgsOptions): string[] {
  if (customOutputArgs) {
    assert(Array.isArray(customOutputArgs), "customOutputArgs must be an array of arguments");
    return customOutputArgs;
  }

  const presetVal = preset ?? (fast ? "ultrafast" : "medium");
  // Bitrate and CRF are mutually exclusive rate-control modes; prefer bitrate
  // when given, otherwise fall back to CRF (default 18).
  const rateControlArgs = videoBitrate ? ["-b:v", videoBitrate] : ["-crf", String(crf ?? 18)];

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
        videoCodec ?? "libx264",
        "-profile:v",
        "high",
        "-preset:v",
        presetVal,
        ...rateControlArgs,
        "-movflags",
        "faststart",
      ];

  const audioOutputArgs = audioFilePath ? ["-acodec", "aac", "-b:a", "128k"] : [];

  return [...audioOutputArgs, ...videoOutputArgs];
}
