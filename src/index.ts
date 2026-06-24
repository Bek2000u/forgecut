import assert from "assert";
import fsExtra from "fs-extra";
import JSON5 from "json5";

import Audio from "./audio.js";
import { Configuration, type ConfigurationOptions } from "./configuration.js";
import { detectFirstVideo, resolveDimensions } from "./core/dimensions.js";
import { resolveFps } from "./core/fps.js";
import { renderFrameLoop } from "./core/frame-loop.js";
import { buildOutputArgs } from "./core/output-args.js";
import { configureFf, ffmpeg } from "./ffmpeg.js";
import { createFrameSource } from "./frameSource.js";
import parseConfig from "./parseConfig.js";
import { createFabricCanvas, rgbaToFabricImage } from "./sources/fabric.js";
import type { RenderSingleFrameConfig } from "./types.js";
import { assertFileValid } from "./util.js";

const channels = 4;

export type * from "./transition.js";
export type * from "./types.js";

/**
 * Edit and render videos.
 *
 * @param config - ConfigurationOptions.
 */
async function Editly(input: ConfigurationOptions): Promise<void> {
  const config = new Configuration(input);
  const {
    // Testing options:
    verbose = false,
    logTimes = false,
    keepTmp = false,
    fast = false,

    outPath,
    clips: clipsIn,
    clipsAudioVolume,
    audioTracks: arbitraryAudioIn,
    width: requestedWidth,
    height: requestedHeight,
    fps: requestedFps,
    audioFilePath: backgroundAudioPath,
    backgroundAudioVolume,
    loopAudio,
    keepSourceAudio,
    allowRemoteRequests,
    audioNorm,
    outputVolume,
    customOutputArgs,
    videoCodec,
    preset,
    crf,
    videoBitrate,
    onProgress,
    isGif,
    tmpDir,
    defaults,
  } = config;

  await configureFf(config);

  if (backgroundAudioPath) await assertFileValid(backgroundAudioPath, allowRemoteRequests);

  if (verbose) console.log(JSON5.stringify(config, null, 2));

  const { clips, arbitraryAudio } = await parseConfig({
    clips: clipsIn,
    arbitraryAudio: arbitraryAudioIn,
    backgroundAudioPath,
    backgroundAudioVolume,
    loopAudio,
    allowRemoteRequests,
    defaults,
  });
  if (verbose) console.log("Calculated", JSON5.stringify({ clips, arbitraryAudio }, null, 2));

  if (verbose) console.log({ tmpDir });
  await fsExtra.mkdirp(tmpDir);

  const { editAudio } = Audio({ verbose, tmpDir });

  const audioFilePath = !isGif
    ? await editAudio({
        keepSourceAudio,
        arbitraryAudio,
        clipsAudioVolume,
        clips,
        audioNorm,
        outputVolume,
      })
    : undefined;

  // Try to detect parameters from first video
  const {
    width: firstVideoWidth,
    height: firstVideoHeight,
    framerateStr: firstVideoFramerateStr,
  } = detectFirstVideo(clips);

  const { width, height } = resolveDimensions({
    requestedWidth,
    requestedHeight,
    isGif,
    fast,
    firstVideoWidth,
    firstVideoHeight,
  });

  const { fps, framerateStr } = resolveFps({ fast, requestedFps, isGif, firstVideoFramerateStr });

  console.log(`${width}x${height} ${fps}fps`);

  const estimatedTotalFrames =
    fps *
    clips.reduce((acc, c, i) => {
      let newAcc = acc + c.duration;
      if (i !== clips.length - 1) newAcc -= c.transition.duration;
      return newAcc;
    }, 0);

  function startFfmpegWriterProcess() {
    const args = [
      "-f",
      "rawvideo",
      "-vcodec",
      "rawvideo",
      "-pix_fmt",
      "rgba",
      "-s",
      `${width}x${height}`,
      "-r",
      framerateStr,
      "-i",
      "-",

      ...(audioFilePath ? ["-i", audioFilePath] : []),

      ...(!isGif ? ["-map", "0:v:0"] : []),
      ...(audioFilePath ? ["-map", "1:a:0"] : []),

      ...buildOutputArgs({
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
      }),

      "-y",
      outPath,
    ];
    return ffmpeg(args, {
      encoding: "buffer",
      buffer: false,
      stdin: "pipe",
      stdout: process.stdout,
      stderr: process.stderr,
    });
  }

  let outProcessExitCode: number | null | undefined;

  try {
    const outProcess = startFfmpegWriterProcess();

    outProcess.on("exit", (code) => {
      if (verbose) console.log("Output ffmpeg exited", code);
      outProcessExitCode = code;
    });

    try {
      await renderFrameLoop({
        clips,
        width,
        height,
        channels,
        fps,
        framerateStr,
        estimatedTotalFrames,
        verbose,
        logTimes,
        outProcess,
        onProgress,
      });
    } catch (err) {
      outProcess.kill();
      throw err;
    }

    try {
      if (verbose) console.log("Waiting for output ffmpeg process to finish");
      await outProcess;
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (outProcessExitCode !== 0 && !(err as any).isTerminated) throw err;
    }
  } finally {
    if (!keepTmp) await fsExtra.remove(tmpDir);
  }

  console.log();
  console.log("Done. Output file can be found at:");
  console.log(outPath);
}

/**
 * Pure function to get a frame at a certain time.
 * TODO: I think this does not respect transition durations
 *
 * @param config - ConfigurationOptions.
 */
export async function renderSingleFrame(input: RenderSingleFrameConfig): Promise<void> {
  const time = input.time ?? 0;

  const config = new Configuration(input);
  const {
    clips: clipsIn,
    allowRemoteRequests,
    width = 800,
    height = 600,
    verbose,
    logTimes,
    outPath = `${Math.floor(Math.random() * 1e12)}.png`,
    defaults,
  } = config;

  await configureFf(config);

  const { clips } = await parseConfig({
    clips: clipsIn,
    arbitraryAudio: [],
    allowRemoteRequests,
    defaults,
  });
  let clipStartTime = 0;
  const clip = clips.find((c) => {
    if (clipStartTime <= time && clipStartTime + c.duration > time) return true;
    clipStartTime += c.duration;
    return false;
  });
  assert(clip, "No clip found at requested time");
  const clipIndex = clips.indexOf(clip);
  const frameSource = await createFrameSource({
    clip,
    clipIndex,
    width,
    height,
    channels,
    verbose,
    logTimes,
    framerateStr: "1",
  });
  const rgba = await frameSource.readNextFrame({ time: time - clipStartTime });

  // TODO converting rgba to png can be done more easily?
  const canvas = createFabricCanvas({ width, height });
  const fabricImage = await rgbaToFabricImage({ width, height, rgba });
  canvas.add(fabricImage);
  canvas.renderAll();
  const internalCanvas = canvas.getNodeCanvas();
  await fsExtra.writeFile(outPath, internalCanvas.toBuffer("image/png"));
  canvas.clear();
  canvas.dispose();
  await frameSource.close();
}

Editly.renderSingleFrame = renderSingleFrame;

export default Editly;
