import type { Options, ResultPromise } from "execa";
import type { ProgressEvent } from "../configuration.js";
import { createFrameSource } from "../frameSource.js";
import type { ProcessedClip } from "../parseConfig.js";

export interface RenderFrameLoopOptions {
  clips: ProcessedClip[];
  width: number;
  height: number;
  channels: number;
  fps: number;
  framerateStr: string;
  estimatedTotalFrames: number;
  verbose: boolean;
  logTimes: boolean;
  outProcess: ResultPromise<Options>;
  onProgress?: (progress: ProgressEvent) => void;
}

/**
 * Sequence the clips frame by frame, compositing transitions between adjacent
 * clips, and write each raw RGBA frame to the output ffmpeg process. Owns the
 * lifecycle of the per-clip frame sources and their transition gl contexts.
 */
export async function renderFrameLoop({
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
}: RenderFrameLoopOptions): Promise<void> {
  let frameSource1;
  let frameSource2;
  let frameSource1Data;

  let totalFramesWritten = 0;
  let fromClipFrameAt = 0;
  let toClipFrameAt = 0;
  let transitionFromClipId = 0;

  const getTransitionToClipId = () => transitionFromClipId + 1;
  const getTransitionFromClip = () => clips[transitionFromClipId];
  const getTransitionToClip = () => clips[getTransitionToClipId()];

  const getSource = async (clip: ProcessedClip, clipIndex: number) =>
    createFrameSource({
      clip,
      clipIndex,
      width,
      height,
      channels,
      verbose,
      logTimes,
      framerateStr,
    });
  const getTransitionFromSource = async () =>
    getSource(getTransitionFromClip(), transitionFromClipId);
  const getTransitionToSource = async () =>
    getTransitionToClip() && getSource(getTransitionToClip(), getTransitionToClipId());

  // If we write and get an EPIPE (like when ffmpeg fails or is finished), we could get an unhandled
  // rejection if we don't catch the promise (and meow causes the CLI to exit on unhandled rejections
  // making it hard to see)
  let outProcessError;
  outProcess.catch((err) => {
    outProcessError = err;
  });

  try {
    frameSource1 = await getTransitionFromSource();
    frameSource2 = await getTransitionToSource();

    while (!outProcessError) {
      const transitionToClip = getTransitionToClip();
      const transitionFromClip = getTransitionFromClip();
      const fromClipNumFrames = Math.round(transitionFromClip.duration * fps);
      const toClipNumFrames = transitionToClip && Math.round(transitionToClip.duration * fps);
      const fromClipProgress = fromClipFrameAt / fromClipNumFrames;
      const toClipProgress = transitionToClip && toClipFrameAt / toClipNumFrames;
      const fromClipTime = transitionFromClip.duration * fromClipProgress;
      const toClipTime = transitionToClip && transitionToClip.duration * toClipProgress;

      const currentTransition = transitionFromClip.transition;
      const transitionNumFrames = Math.round(currentTransition.duration * fps);
      const runTransitionOnFrame = currentTransition.create({ width, height, channels });

      // Each clip has two transitions, make sure we leave enough room:
      const transitionNumFramesSafe = Math.floor(
        Math.min(
          Math.min(
            fromClipNumFrames,
            toClipNumFrames != null ? toClipNumFrames : Number.MAX_SAFE_INTEGER,
          ) / 2,
          transitionNumFrames,
        ),
      );
      // How many frames into the transition are we? negative means not yet started
      const transitionFrameAt = fromClipFrameAt - (fromClipNumFrames - transitionNumFramesSafe);

      const percentDone = Math.min(
        100,
        Math.floor(100 * (totalFramesWritten / estimatedTotalFrames)),
      );
      onProgress?.({
        percent: percentDone,
        frame: totalFramesWritten,
        totalFrames: Math.round(estimatedTotalFrames),
      });
      if (!verbose && totalFramesWritten % 10 === 0) {
        process.stdout.write(`${String(percentDone).padStart(3, " ")}% `);
      }

      const transitionLastFrameIndex = transitionNumFramesSafe;

      // Done with transition?
      if (transitionFrameAt >= transitionLastFrameIndex) {
        transitionFromClipId += 1;
        console.log(
          `Done with transition, switching to next transitionFromClip (${transitionFromClipId})`,
        );

        if (!getTransitionFromClip()) {
          console.log("No more transitionFromClip, done");
          break;
        }

        // Cleanup completed frameSource1 and its transition (the gl context),
        // then swap and load next frameSource2
        currentTransition.close();
        await frameSource1.close();
        frameSource1 = frameSource2;
        frameSource2 = await getTransitionToSource();

        fromClipFrameAt = transitionLastFrameIndex;
        toClipFrameAt = 0;

        continue;
      }

      if (logTimes) console.time("Read frameSource1");
      const newFrameSource1Data = await frameSource1.readNextFrame({ time: fromClipTime });
      if (logTimes) console.timeEnd("Read frameSource1");
      // If we got no data, use the old data
      // TODO maybe abort?
      if (newFrameSource1Data) frameSource1Data = newFrameSource1Data;
      else console.warn("No frame data returned, using last frame");

      const isInTransition = frameSource2 && transitionNumFramesSafe > 0 && transitionFrameAt >= 0;

      let outFrameData;

      if (isInTransition) {
        if (logTimes) console.time("Read frameSource2");
        const frameSource2Data = await frameSource2.readNextFrame({ time: toClipTime });
        if (logTimes) console.timeEnd("Read frameSource2");

        if (frameSource2Data) {
          const progress = transitionFrameAt / transitionNumFramesSafe;

          if (logTimes) console.time("runTransitionOnFrame");

          outFrameData = runTransitionOnFrame({
            fromFrame: frameSource1Data!,
            toFrame: frameSource2Data,
            progress: progress,
          });

          if (logTimes) console.timeEnd("runTransitionOnFrame");
        } else {
          console.warn("Got no frame data from transitionToClip!");
          // We have probably reached end of clip2 but transition is not complete. Just pass thru clip1
          outFrameData = frameSource1Data;
        }
      } else {
        // Not in transition. Pass thru clip 1
        outFrameData = frameSource1Data;
      }

      if (verbose) {
        if (isInTransition)
          console.log(
            "Writing frame:",
            totalFramesWritten,
            "from clip",
            transitionFromClipId,
            `(frame ${fromClipFrameAt})`,
            "to clip",
            getTransitionToClipId(),
            `(frame ${toClipFrameAt} / ${transitionNumFramesSafe})`,
            currentTransition.name,
            `${currentTransition.duration}s`,
          );
        else
          console.log(
            "Writing frame:",
            totalFramesWritten,
            "from clip",
            transitionFromClipId,
            `(frame ${fromClipFrameAt})`,
          );
      }

      if (logTimes) console.time("outProcess.write");

      // If we don't wait, then we get EINVAL when dealing with high resolution files (big writes)
      await new Promise((r) => outProcess?.stdin?.write(outFrameData, r));

      if (logTimes) console.timeEnd("outProcess.write");

      if (outProcessError) break;

      totalFramesWritten += 1;
      fromClipFrameAt += 1;
      if (isInTransition) toClipFrameAt += 1;
    } // End while loop

    outProcess.stdin?.end();
  } finally {
    if (verbose) console.log("Cleanup");
    if (frameSource1) await frameSource1.close();
    if (frameSource2) await frameSource2.close();
    // Backstop: free any transition gl contexts not released during the loop
    // (e.g. the last clip's transition, or on early error). close() is idempotent.
    for (const clip of clips) clip.transition?.close();
  }
}
