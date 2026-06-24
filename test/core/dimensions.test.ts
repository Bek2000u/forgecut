import { describe, expect, test } from "vitest";
import { detectFirstVideo, resolveDimensions } from "../../src/core/dimensions.js";
import type { ProcessedClip } from "../../src/parseConfig.js";

describe("resolveDimensions", () => {
  test("defaults to 640x640 with no video and no request", () => {
    expect(resolveDimensions({})).toEqual({ width: 640, height: 640 });
  });

  test("uses first video size when nothing requested", () => {
    expect(resolveDimensions({ firstVideoWidth: 1920, firstVideoHeight: 1080 })).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  test("scales height to preserve aspect when only width requested", () => {
    expect(
      resolveDimensions({ requestedWidth: 1280, firstVideoWidth: 1920, firstVideoHeight: 1080 }),
    ).toEqual({ width: 1280, height: 720 });
  });

  test("explicit width+height overrides detected size", () => {
    expect(
      resolveDimensions({
        requestedWidth: 100,
        requestedHeight: 200,
        firstVideoWidth: 1920,
        firstVideoHeight: 1080,
      }),
    ).toEqual({ width: 100, height: 200 });
  });

  test("gif defaults width to 320", () => {
    expect(
      resolveDimensions({ isGif: true, firstVideoWidth: 640, firstVideoHeight: 480 }).width,
    ).toBe(320);
  });

  test("clamps non-gif output to a minimum of 2", () => {
    expect(resolveDimensions({ requestedWidth: 1, requestedHeight: 1 })).toEqual({
      width: 2,
      height: 2,
    });
  });

  test("fast mode downscales below the source size", () => {
    const { width, height } = resolveDimensions({
      fast: true,
      firstVideoWidth: 1920,
      firstVideoHeight: 1080,
    });
    expect(width).toBeLessThan(1920);
    expect(width % 2).toBe(0);
    expect(height % 2).toBe(0);
  });
});

describe("detectFirstVideo", () => {
  test("returns the first video layer's dimensions and framerate", () => {
    const clips = [
      { layers: [{ type: "image" }] },
      { layers: [{ type: "video", inputWidth: 1920, inputHeight: 1080, framerateStr: "30/1" }] },
    ] as unknown as ProcessedClip[];
    expect(detectFirstVideo(clips)).toEqual({
      width: 1920,
      height: 1080,
      framerateStr: "30/1",
    });
  });

  test("returns empty when there is no video layer", () => {
    const clips = [{ layers: [{ type: "image" }] }] as unknown as ProcessedClip[];
    expect(detectFirstVideo(clips)).toEqual({});
  });
});
