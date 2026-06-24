import { describe, expect, test } from "vitest";
import { buildAudioMixFilter } from "../../src/core/audio-mix.js";

describe("buildAudioMixFilter (no ducking)", () => {
  test("matches the original amix filtergraph exactly", () => {
    const filter = buildAudioMixFilter({ streams: [{}, { mixVolume: 0.5 }] });
    expect(filter).toBe(
      "[0:a]atrim=start=0,adelay=delays=0:all=1[a0];" +
        "[1:a]atrim=start=0,adelay=delays=0:all=1,apad[a1];" +
        "[a0][a1]amix=inputs=2:duration=first:dropout_transition=0:weights=1 0.5",
    );
  });

  test("appends dynaudnorm and volume suffixes", () => {
    const filter = buildAudioMixFilter({
      streams: [{}, {}],
      audioNorm: { enable: true, gaussSize: 7, maxGain: 20 },
      outputVolume: 2,
    });
    expect(filter).toContain("dynaudnorm=g=7:maxgain=20");
    expect(filter).toContain(",volume=2");
  });

  test("does not duck when only one role is present", () => {
    const filter = buildAudioMixFilter({ streams: [{}, { ducking: "ducked" }] });
    expect(filter).not.toContain("sidechaincompress");
    expect(filter).toContain("amix=inputs=2");
  });
});

describe("buildAudioMixFilter (ducking)", () => {
  const streams = [
    {}, // clip audio (passthrough, stays first)
    { ducking: "trigger" as const }, // voice-over
    { ducking: "ducked" as const, mixVolume: 0.3 }, // music
  ];

  test("ducks the music under the voice via sidechaincompress", () => {
    const filter = buildAudioMixFilter({ streams });
    expect(filter).toContain(
      "[a2][trigkey0]sidechaincompress=threshold=0.03:ratio=12:attack=20:release=300[duck0]",
    );
  });

  test("splits the trigger into an output copy plus one key per ducked track", () => {
    expect(buildAudioMixFilter({ streams })).toContain("[a1]asplit=2[trigout][trigkey0]");
  });

  test("keeps the first stream first in the final mix (duration=first)", () => {
    const filter = buildAudioMixFilter({ streams });
    expect(filter).toContain(
      "[a0][trigout][duck0]amix=inputs=3:duration=first:dropout_transition=0:weights=1 1 0.3",
    );
  });

  test("honors custom sidechain parameters", () => {
    const filter = buildAudioMixFilter({
      streams,
      ducking: { threshold: 0.05, ratio: 8, attack: 5, release: 250 },
    });
    expect(filter).toContain("threshold=0.05:ratio=8:attack=5:release=250");
  });
});
