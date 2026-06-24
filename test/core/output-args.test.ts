import { describe, expect, test } from "vitest";
import { buildOutputArgs } from "../../src/core/output-args.js";

describe("buildOutputArgs", () => {
  test("returns customOutputArgs verbatim", () => {
    const custom = ["-vcodec", "h264_nvenc"];
    expect(buildOutputArgs({ fps: 30, width: 1920, height: 1080, customOutputArgs: custom })).toBe(
      custom,
    );
  });

  test("uses libx264 with faststart for normal video output", () => {
    const args = buildOutputArgs({ fps: 30, width: 1920, height: 1080 });
    expect(args).toContain("libx264");
    expect(args).toContain("faststart");
  });

  test("uses a palette filter for gif", () => {
    const args = buildOutputArgs({ isGif: true, fps: 10, width: 320, height: 240 });
    expect(args.join(" ")).toContain("palettegen");
  });

  test("uses the ultrafast preset in fast mode", () => {
    const args = buildOutputArgs({ fast: true, fps: 15, width: 320, height: 240 });
    expect(args).toContain("ultrafast");
  });

  test("adds aac audio args only when an audio file is present", () => {
    expect(buildOutputArgs({ fps: 30, width: 100, height: 100 })).not.toContain("aac");
    expect(
      buildOutputArgs({ fps: 30, width: 100, height: 100, audioFilePath: "/a.aac" }),
    ).toContain("aac");
  });

  test("honors a custom video codec (e.g. hardware encoder)", () => {
    const args = buildOutputArgs({ fps: 30, width: 1920, height: 1080, videoCodec: "h264_nvenc" });
    expect(args).toContain("h264_nvenc");
    expect(args).not.toContain("libx264");
  });

  test("uses the requested crf and preset", () => {
    const args = buildOutputArgs({ fps: 30, width: 1920, height: 1080, crf: 23, preset: "slow" });
    expect(args).toEqual(expect.arrayContaining(["-crf", "23", "-preset:v", "slow"]));
  });

  test("uses bitrate instead of crf when videoBitrate is set", () => {
    const args = buildOutputArgs({ fps: 30, width: 1920, height: 1080, videoBitrate: "5M" });
    expect(args).toEqual(expect.arrayContaining(["-b:v", "5M"]));
    expect(args).not.toContain("-crf");
  });
});
