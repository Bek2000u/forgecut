import { describe, expect, test } from "vitest";
import { resolveFps } from "../../src/core/fps.js";

describe("resolveFps", () => {
  test("fast mode is 15fps", () => {
    expect(resolveFps({ fast: true })).toEqual({ fps: 15, framerateStr: "15" });
  });

  test("requested fps wins", () => {
    expect(resolveFps({ requestedFps: 60 })).toEqual({ fps: 60, framerateStr: "60" });
  });

  test("gif defaults to 10fps", () => {
    expect(resolveFps({ isGif: true })).toEqual({ fps: 10, framerateStr: "10" });
  });

  test("derives framerateStr from the numeric fps for fractional source rates", () => {
    const { fps, framerateStr } = resolveFps({ firstVideoFramerateStr: "30000/1001" });
    expect(fps).toBeCloseTo(29.97, 2);
    // framerateStr is synced to the numeric fps, never the raw fraction
    expect(framerateStr).toBe(String(fps));
    expect(framerateStr).not.toBe("30000/1001");
  });

  test("falls back to 25fps", () => {
    expect(resolveFps({})).toEqual({ fps: 25, framerateStr: "25" });
  });
});
