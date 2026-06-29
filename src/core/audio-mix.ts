import type { AudioDuckingOptions } from "../types.js";

export interface AudioMixStream {
  start?: number;
  cutFrom?: number;
  cutTo?: number;
  mixVolume?: number | string;
  /**
   * Sidechain ducking role. "trigger" tracks (e.g. a voice-over) duck the
   * "ducked" tracks (e.g. background music) when they are loud.
   */
  ducking?: "trigger" | "ducked";
}

export interface AudioNormParams {
  enable?: boolean;
  mode?: "dynaudnorm" | "loudnorm";
  gaussSize?: number;
  maxGain?: number;
  targetLufs?: number;
  truePeakDb?: number;
  loudnessRange?: number;
}

/**
 * Build the trailing `,<filter>` fragment that normalizes the mixed-down audio,
 * or `""` when normalization is disabled. Appended to the final `amix` chain.
 *
 * - `dynaudnorm` (default): dynamic, window-based leveling.
 * - `loudnorm`: single-pass EBU R128 toward an integrated LUFS target — match
 *   this to the destination platform (YouTube ≈ -14 LUFS).
 */
function buildAudioNormArg(audioNorm?: AudioNormParams): string {
  if (!audioNorm?.enable) return "";

  if (audioNorm.mode === "loudnorm") {
    const i = audioNorm.targetLufs ?? -14;
    const tp = audioNorm.truePeakDb ?? -1;
    const lra = audioNorm.loudnessRange ?? 7;
    return `,loudnorm=I=${i}:TP=${tp}:LRA=${lra}`;
  }

  const gaussSize = audioNorm.gaussSize ?? 5;
  const maxGain = audioNorm.maxGain ?? 30;
  return `,dynaudnorm=g=${gaussSize}:maxgain=${maxGain}`;
}

export interface BuildAudioMixFilterOptions {
  streams: AudioMixStream[];
  audioNorm?: AudioNormParams;
  outputVolume?: number | string;
  ducking?: AudioDuckingOptions;
}

const weightOf = (s: AudioMixStream) => (s.mixVolume != null ? s.mixVolume : 1);

/**
 * Build the ffmpeg `-filter_complex` string that trims/delays each input track
 * and mixes them down. When tracks carry sidechain `ducking` roles (at least
 * one "trigger" and one "ducked"), the ducked tracks are compressed under the
 * combined trigger before the final mix; otherwise a plain `amix` is produced
 * (byte-identical to the original behaviour).
 *
 * The first stream is kept first in the final mix so `duration=first` continues
 * to bound the output to the clip-audio length.
 */
export function buildAudioMixFilter({
  streams,
  audioNorm,
  outputVolume,
  ducking,
}: BuildAudioMixFilterOptions): string {
  // Trim/delay each input into [a{i}]. https://stackoverflow.com/questions/35509147
  const inputFilters = streams
    .map(({ start, cutFrom, cutTo }, i) => {
      const cutToArg = cutTo != null ? `:end=${cutTo}` : "";
      // Don't pad the first track (audio from video clips with correct duration)
      const apadArg = i > 0 ? ",apad" : "";
      return `[${i}:a]atrim=start=${cutFrom || 0}${cutToArg},adelay=delays=${Math.floor((start || 0) * 1000)}:all=1${apadArg}[a${i}]`;
    })
    .join(";");

  const audioNormArg = buildAudioNormArg(audioNorm);
  const volumeArg = outputVolume != null ? `,volume=${outputVolume}` : "";

  const triggers = streams.filter((s) => s.ducking === "trigger");
  const ducked = streams.filter((s) => s.ducking === "ducked");
  const useDucking = triggers.length > 0 && ducked.length > 0;

  if (!useDucking) {
    const inputs = streams.map((_, i) => `[a${i}]`).join("");
    const weights = streams.map(weightOf).join(" ");
    return `${inputFilters};${inputs}amix=inputs=${streams.length}:duration=first:dropout_transition=0:weights=${weights}${audioNormArg}${volumeArg}`;
  }

  const { threshold = 0.03, ratio = 12, attack = 20, release = 300 } = ducking ?? {};
  const parts = [inputFilters];

  // Combine the trigger inputs into a single key source.
  let triggerLabel: string;
  if (triggers.length === 1) {
    triggerLabel = `a${streams.indexOf(triggers[0])}`;
  } else {
    const trigInputs = triggers.map((t) => `[a${streams.indexOf(t)}]`).join("");
    parts.push(
      `${trigInputs}amix=inputs=${triggers.length}:duration=longest:dropout_transition=0[trigmix]`,
    );
    triggerLabel = "trigmix";
  }

  // One copy of the trigger for the final mix, plus one key per ducked stream.
  const keyLabels = ducked.map((_, k) => `[trigkey${k}]`).join("");
  parts.push(`[${triggerLabel}]asplit=${1 + ducked.length}[trigout]${keyLabels}`);

  // Duck each ducked stream under its trigger key copy.
  ducked.forEach((d, k) => {
    const i = streams.indexOf(d);
    parts.push(
      `[a${i}][trigkey${k}]sidechaincompress=threshold=${threshold}:ratio=${ratio}:attack=${attack}:release=${release}[duck${k}]`,
    );
  });

  // Final mix, walking streams in order so the first stream stays first.
  const finalInputs: string[] = [];
  const finalWeights: (number | string)[] = [];
  let firstTriggerSeen = false;
  let duckIndex = 0;
  streams.forEach((s) => {
    if (s.ducking === "ducked") {
      finalInputs.push(`[duck${duckIndex}]`);
      finalWeights.push(weightOf(s));
      duckIndex += 1;
    } else if (s.ducking === "trigger") {
      // The combined trigger is represented once, at the first trigger's spot.
      if (!firstTriggerSeen) {
        finalInputs.push("[trigout]");
        finalWeights.push(triggers.length === 1 ? weightOf(s) : 1);
        firstTriggerSeen = true;
      }
    } else {
      finalInputs.push(`[a${streams.indexOf(s)}]`);
      finalWeights.push(weightOf(s));
    }
  });

  parts.push(
    `${finalInputs.join("")}amix=inputs=${finalInputs.length}:duration=first:dropout_transition=0:weights=${finalWeights.join(" ")}${audioNormArg}${volumeArg}`,
  );

  return parts.join(";");
}
