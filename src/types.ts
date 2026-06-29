// TODO[ts]: Move these elsewhere

import type { Canvas } from "canvas";
import type * as Fabric from "fabric/node";
import { ConfigurationOptions } from "./configuration.js";
import { TransitionOptions } from "./transition.js";

/** Little utility */
export type OptionalPromise<T> = Promise<T> | T;

export type OriginX = Fabric.TOriginX;

export type OriginY = Fabric.TOriginY;

/**
 * How to fit image to screen. Can be one of:
 * - `'contain'` - All the video will be contained within the frame and letterboxed.
 * - `'contain-blur'` - Like contain, but with a blurred copy as the letterbox.
 * - `'cover'` - Video be cropped to cover the whole screen (aspect ratio preserved).
 * - `'stretch'` - Video will be stretched to cover the whole screen (aspect ratio ignored).
 *
 * @default 'contain-blur'
 * @see [Example 'image.json5']{@link https://github.com/mifi/editly/blob/master/examples/image.json5}
 * @see [Example 'videos.json5']{@link https://github.com/mifi/editly/blob/master/examples/videos.json5}
 */
export type ResizeMode = "contain" | "contain-blur" | "cover" | "stretch";

/**
 * An object, where `{ x: 0, y: 0 }` is the upper left corner of the screen and `{ x: 1, y: 1 }` is the lower right corner.
 */
export interface PositionObject {
  /**
   * X-position relative to video width.
   */
  x: number;

  /**
   * Y-position relative to video height.
   */
  y: number;

  /**
   * X-anchor position of the object.
   */
  originX?: OriginX;

  /**
   * Y-anchor position of the object.
   */
  originY?: OriginY;
}

/**
 * Certain layers support the position parameter.
 *
 * @see [Position parameter]{@link https://github.com/mifi/editly#position-parameter}
 * @see [Example 'position.json5']{@link https://github.com/mifi/editly/blob/master/examples/position.json5}
 */
export type Position =
  | "top"
  | "top-left"
  | "top-right"
  | "center"
  | "center-left"
  | "center-right"
  | "bottom"
  | "bottom-left"
  | "bottom-right"
  | PositionObject;

/**
 * @see [Arbitrary audio tracks]{@link https://github.com/mifi/editly#arbitrary-audio-tracks}
 */
export interface AudioTrack {
  /**
   * File path for this track.
   */
  path: string;

  /**
   * Relative volume for this track.
   *
   * @default 1
   */
  mixVolume?: number | string;

  /**
   * Time value to cut source file from (in seconds).
   *
   * @default 0
   */
  cutFrom?: number;

  /**
   * Time value to cut source file to (in seconds).
   */
  cutTo?: number;

  /**
   * How many seconds into video to start this audio track.
   *
   * @default 0
   */
  start?: number;

  /**
   * Sidechain ducking role. "trigger" tracks (e.g. a voice-over) duck the
   * volume of "ducked" tracks (e.g. background music) while they play. Takes
   * effect only when at least one "trigger" and one "ducked" track are present.
   */
  ducking?: "trigger" | "ducked";
}

/**
 * Sidechain compression parameters used when audio tracks carry `ducking`
 * roles. See ffmpeg's `sidechaincompress` filter.
 */
export interface AudioDuckingOptions {
  /** Compression threshold (0-1); lower ducks more readily. @default 0.03 */
  threshold?: number;
  /** Compression ratio; higher ducks harder. @default 12 */
  ratio?: number;
  /** Attack time in ms. @default 20 */
  attack?: number;
  /** Release time in ms. @default 300 */
  release?: number;
}

/**
 * @see [Ken Burns parameters]{@link https://github.com/mifi/editly#ken-burns-parameters}
 */
export interface KenBurns {
  /**
   * Zoom direction for Ken Burns effect.
   * Use `null` to disable.
   */
  zoomDirection?: "in" | "out" | "left" | "right" | null;

  /**
   * Zoom amount for Ken Burns effect.
   *
   * @default 0.1
   */
  zoomAmount?: number;
}

export type LayerType =
  | "video"
  | "audio"
  | "detached-audio"
  | "image"
  | "image-overlay"
  | "title"
  | "subtitle"
  | "title-background"
  | "news-title"
  | "slide-in-text"
  | "fill-color"
  | "pause"
  | "radial-gradient"
  | "linear-gradient"
  | "rainbow-colors"
  | "canvas"
  | "fabric"
  | "gl"
  | "editly-banner";

export interface BaseLayer {
  /**
   * Layer type.
   */
  type: LayerType;

  /**
   * What time into the clip should this layer start (in seconds).
   */
  start?: number;

  /**
   * What time into the clip should this layer stop (in seconds).
   */
  stop?: number;

  /**
   * FIXME[ts]: This is used internally and should be removed after some refactoring.
   * @private
   */
  layerDuration?: number;
}

export interface TextLayer extends BaseLayer {
  /**
   * Subtitle text to show.
   */
  text: string;

  /**
   * Text color.
   * Defaults to '#ffffff'.
   */
  textColor?: string;

  /**
   * Set font (`.ttf`).
   * Defaults to system font.
   */
  fontPath?: string;

  /**
   * WARNING: Undocumented feature!
   * The font family to use. Must already be registered using `fontPath`.
   * If `fontPath` is also provided, this will be ignored.
   */
  fontFamily?: string;
}

export interface VideoPostProcessingFunctionArgs {
  canvas: Fabric.StaticCanvas;
  image: Fabric.FabricImage;
  fabric: typeof Fabric;
  progress: number;
  time: number;
}

/**
 * For video layers, if parent `clip.duration` is specified, the video will be slowed/sped-up to match `clip.duration`.
 * If `cutFrom`/`cutTo` is set, the resulting segment (`cutTo`-`cutFrom`) will be slowed/sped-up to fit `clip.duration`.
 * If the layer has audio, it will be kept (and mixed with other audio layers if present).
 */
export interface VideoLayer extends BaseLayer {
  /**
   * Layer type.
   */
  type: "video";

  /**
   * Path to video file.
   */
  path: string;

  /**
   * How to fit video to screen.
   *
   * @default 'contain-blur'
   * @see [Resize modes]{@link https://github.com/mifi/editly#resize-modes}
   */
  resizeMode?: ResizeMode;

  /**
   * Time value to cut from (in seconds).
   *
   * @default 0
   */
  cutFrom?: number;

  /**
   * Time value to cut to (in seconds).
   * Defaults to *end of video*.
   */
  cutTo?: number;

  /**
   * Width relative to screen width.
   * Must be between 0 and 1.
   *
   * @default 1
   */
  width?: number;

  /**
   * Height relative to screen height.
   * Must be between 0 and 1.
   *
   * @default 1
   */
  height?: number;

  /**
   * X-position relative to screen width.
   * Must be between 0 and 1.
   *
   * @default 0
   */
  left?: number;

  /**
   * Y-position relative to screen height.
   * Must be between 0 and 1.
   *
   * @default 0
   */
  top?: number;

  /**
   * X-anchor.
   *
   * @default 'left'
   */
  originX?: OriginX;

  /**
   * Y-anchor.
   *
   * @default 'top'
   */
  originY?: OriginY;

  /**
   * Relative volume when mixing this video's audio track with others.
   *
   * @default 1
   */
  mixVolume?: number | string;

  /**
   * Post-processing function after calling rgbaToFabricImage but before adding it to StaticCanvas.
   */
  fabricImagePostProcessing?: (data: VideoPostProcessingFunctionArgs) => Promise<void>;

  // FIXME[TS]: Used internally, but should be removed after refactoring
  framerateStr?: string;
  inputWidth?: number;
  inputHeight?: number;
  speedFactor?: number;
}

/**
 * Audio layers will be mixed together.
 * If `cutFrom`/`cutTo` is set, the resulting segment (`cutTo`-`cutFrom`) will be slowed/sped-up to fit `clip.duration`.
 * The slow down/speed-up operation is limited to values between `0.5x` and `100x`.
 */
export interface AudioLayer extends BaseLayer {
  /**
   * Layer type.
   */
  type: "audio";

  /**
   * Path to audio file.
   */
  path: string;

  /**
   * Time value to cut from (in seconds).
   *
   * @default 0
   */
  cutFrom?: number;

  /**
   * Time value to cut to (in seconds).
   * Defaults to `clip.duration`.
   */
  cutTo?: number;

  /**
   * Relative volume when mixing this audio track with others.
   *
   * @default 1
   */
  mixVolume?: number | string;
}

/**
 * This is a special case of `audioTracks` that makes it easier to start the audio relative to clips start times,
 * without having to calculate global start times.
 *
 * This layer has the exact same properties as [`audioTracks`]{@link https://github.com/mifi/editly#arbitrary-audio-tracks},
 * except `start` time is relative to the clip's start.
 */
export interface DetachedAudioLayer extends BaseLayer, AudioTrack {
  /**
   * Layer type.
   */
  type: "detached-audio";
}

/**
 * Full screen image.
 */
export interface ImageLayer extends BaseLayer, KenBurns {
  /**
   * Layer type.
   */
  type: "image";

  /**
   * Path to image file.
   */
  path: string;

  /**
   * How to fit image to screen.
   */
  resizeMode?: ResizeMode;

  /**
   * WARNING: Undocumented feature!
   */
  duration?: number;
}

/**
 * Image overlay with a custom position and size on the screen.
 */
export interface ImageOverlayLayer extends BaseLayer, KenBurns {
  /**
   * Layer type.
   */
  type: "image-overlay";

  /**
   * Path to image file.
   */
  path: string;

  /**
   * Position.
   */
  position?: Position;

  /**
   * Width (from 0 to 1) where 1 is screen width.
   */
  width?: number;

  /**
   * Height (from 0 to 1) where 1 is screen height.
   */
  height?: number;
}

export interface TitleLayer extends TextLayer, KenBurns {
  /**
   * Layer type.
   */
  type: "title";

  /**
   * Position.
   */
  position?: Position;
}

/**
 * A single timed word for karaoke-style subtitle highlighting.
 * Times are in seconds, relative to the subtitle layer's start.
 */
export interface SubtitleWord {
  word: string;
  start: number;
  end: number;
}

export interface SubtitleLayer extends TextLayer {
  /**
   * Layer type.
   */
  type: "subtitle";

  /**
   * WARNING: Undocumented feature!
   */
  backgroundColor?: string;

  delay: number;
  speed: number;

  /**
   * Per-word timings. When set, the full caption is shown and the word being
   * spoken at the current time is highlighted (karaoke style), instead of the
   * single-line fade-in used for plain `text`.
   */
  words?: SubtitleWord[];

  /**
   * Fill color for the currently-spoken word (used with `words`).
   * @default "#ffe000"
   */
  activeColor?: string;

  /**
   * Absolute font size in px.
   * @default min(width, height) / 20
   */
  fontSize?: number;

  /**
   * Outline color for legibility over busy video.
   */
  strokeColor?: string;

  /**
   * Outline width in px.
   * @default 0
   */
  strokeWidth?: number;

  /**
   * Vertical placement of the caption.
   * @default "bottom"
   */
  position?: "top" | "center" | "bottom";

  /**
   * Maximum text width as a fraction of canvas width (0-1).
   * @default 0.9
   */
  maxWidth?: number;

  /**
   * Karaoke rendering style (only used with `words`):
   *
   * - `"highlight"` — show the full caption and recolor the spoken word
   *   (podcast / YouTube style). This is the default.
   * - `"single-word"` — show only the word being spoken, centered, with a
   *   pop-in animation (TikTok / Shorts style).
   *
   * @default "highlight"
   */
  karaokeStyle?: "highlight" | "single-word";

  /**
   * Duration of the per-word pop-in animation in seconds (used with
   * `karaokeStyle: "single-word"`). The word scales/fades from `popScale` up
   * to its full size over this window at the start of each word.
   *
   * @default 0.15
   */
  popInDuration?: number;

  /**
   * Starting scale of the per-word pop-in, as a multiple of the final size
   * (used with `karaokeStyle: "single-word"`). `< 1` grows the word in,
   * `> 1` shrinks it in. Set to `1` to disable scaling (fade only).
   *
   * @default 0.7
   */
  popScale?: number;
}

/**
 * Title with background.
 */
export interface TitleBackgroundLayer extends TextLayer {
  /**
   * Layer type.
   */
  type: "title-background";

  /**
   * Background layer.
   * Defaults to random background.
   */
  background?: BackgroundLayer;
}

export interface NewsTitleLayer extends TextLayer {
  /**
   * Layer type.
   */
  type: "news-title";

  /**
   * Background color.
   * Defaults to '#d02a42'.
   */
  backgroundColor?: string;

  /**
   * Position.
   */
  position?: Position;

  delay: number;
  speed: number;
}

export interface SlideInTextLayer extends TextLayer {
  /**
   * Layer type.
   */
  type: "slide-in-text";

  /**
   * Font size.
   */
  fontSize?: number;

  /**
   * Char spacing.
   */
  charSpacing?: number;

  /**
   * Color.
   * @deprecated use `fontColor` instead.
   */
  color?: string;

  /**
   * Position.
   */
  position?: Position;
}

export interface FillColorLayer extends BaseLayer {
  /**
   * Layer type.
   */
  type: "fill-color";

  /**
   * Color to fill background.
   * Defaults to random color.
   */
  color?: string;
}

export interface PauseLayer extends BaseLayer {
  /**
   * Layer type.
   */
  type: "pause";

  /**
   * Color to fill background.
   * Defaults to random color.
   */
  color?: string;
}

export interface RadialGradientLayer extends BaseLayer {
  /**
   * Layer type.
   */
  type: "radial-gradient";

  /**
   * Array of two colors.
   * Defaults to random colors.
   */
  colors?: [string, string];
}

export interface LinearGradientLayer extends BaseLayer {
  /**
   * Layer type.
   */
  type: "linear-gradient";

  /**
   * Array of two colors.
   * Defaults to random colors.
   */
  colors?: [string, string];
}

export interface RainbowColorsLayer extends BaseLayer {
  /**
   * Layer type.
   */
  type: "rainbow-colors";
}

export interface CustomFabricFunctionCallbacks {
  onRender: (progress: number, canvas: Fabric.StaticCanvas) => OptionalPromise<void>;
  onClose?: () => OptionalPromise<void>;
}

export interface CustomCanvasFunctionArgs {
  width: number;
  height: number;
  canvas: Canvas;
}

export interface CustomCanvasFunctionCallbacks {
  onRender: (progress: number) => OptionalPromise<void>;
  onClose?: () => OptionalPromise<void>;
}

export type CustomCanvasFunction = (
  args: CustomCanvasFunctionArgs,
) => OptionalPromise<CustomCanvasFunctionCallbacks>;

export interface CanvasLayer extends BaseLayer {
  /**
   * Layer type.
   */
  type: "canvas";

  /**
   * Custom JavaScript function.
   */
  func: CustomCanvasFunction;
}

export interface CustomFabricFunctionArgs {
  width: number;
  height: number;
  fabric: typeof Fabric;
  params: unknown;
}

export type CustomFabricFunction = (
  args: CustomFabricFunctionArgs,
) => OptionalPromise<CustomFabricFunctionCallbacks>;

export interface FabricLayer extends BaseLayer {
  /**
   * Layer type.
   */
  type: "fabric";

  /**
   * Custom JavaScript function.
   */
  func: CustomFabricFunction;
}

export interface GlLayer extends BaseLayer {
  /**
   * Layer type.
   */
  type: "gl";

  /**
   * Fragment path (`.frag` file)
   */
  fragmentPath: string;

  /**
   * Vertex path (`.vert` file).
   */
  vertexPath?: string;

  /**
   * WARNING: Undocumented feature!
   */
  speed?: number;

  vertexSrc?: string;
  fragmentSrc?: string;
}

/**
 * WARNING: Undocumented feature!
 */
export interface EditlyBannerLayer extends BaseLayer {
  /**
   * Layer type.
   */
  type: "editly-banner";

  /**
   * Set font (`.ttf`).
   * Defaults to system font.
   */
  fontPath?: string;
}

/**
 * @see [Examples]{@link https://github.com/mifi/editly/tree/master/examples}
 * @see [Example 'commonFeatures.json5']{@link https://github.com/mifi/editly/blob/master/examples/commonFeatures.json5}
 */
export type Layer =
  | VideoLayer
  | AudioLayer
  | DetachedAudioLayer
  | ImageLayer
  | ImageOverlayLayer
  | TitleLayer
  | SubtitleLayer
  | TitleBackgroundLayer
  | NewsTitleLayer
  | SlideInTextLayer
  | FillColorLayer
  | PauseLayer
  | RadialGradientLayer
  | LinearGradientLayer
  | RainbowColorsLayer
  | CanvasLayer
  | FabricLayer
  | GlLayer
  | EditlyBannerLayer;

/**
 * Special layers that can be used f.e. in the 'title-background' layer.
 */
export type BackgroundLayer = RadialGradientLayer | LinearGradientLayer | FillColorLayer;

export interface Clip {
  /**
   * List of layers within the current clip that will be overlaid in their natural order (final layer on top).
   */
  layers: Layer[];

  /**
   * Clip duration.
   * If unset, the clip duration will be that of the first video layer.
   * Defaults to `defaults.duration`.
   */
  duration?: number;

  /**
   * Specify transition at the end of this clip.
   * Defaults to `defaults.transition`.
   * Set to `null` to disable transitions.
   */
  transition?: TransitionOptions | null;
}

export interface DefaultLayerOptions {
  /**
   * Set default font (`.ttf`).
   * Defaults to system font.
   */
  fontPath?: string;

  /**
   * Set any layer parameter that all layers will inherit.
   */
  // FIXME[ts]: Define a type for this
  [key: string]: unknown;
}

export type DefaultLayerTypeOptions = {
  /**
   * Set any layer parameter that all layers of the same type (specified in key) will inherit.
   */
  [P in LayerType]?: Partial<Omit<Extract<Layer, { type: P }>, "type">>;
};

export interface DefaultOptions {
  /**
   * Set default clip duration for clips that don't have an own duration (in seconds).
   *
   * @default 4
   */
  duration?: number;

  /**
   * An object describing the default layer options.
   */
  layer?: DefaultLayerOptions;

  /**
   * Defaults for each individual layer types.
   */
  layerType?: DefaultLayerTypeOptions;

  /**
   * An object describing the default transition.
   * Set to `null` to disable transitions.
   */
  transition?: TransitionOptions | null;
}

/**
 * You can enable audio normalization of the final output audio.
 * This is useful if you want to achieve Audio Ducking (e.g. automatically lower volume of all other tracks when voice-over speaks).
 *
 * @see [Dynaudnorm]{@link https://ffmpeg.org/ffmpeg-filters.html#dynaudnorm}
 * @see [Example of audio ducking]{@link https://github.com/mifi/editly/blob/master/examples/audio2.json5}
 */
export interface AudioNormalizationOptions {
  /**
   * Enable audio normalization?
   *
   * @default false
   * @see [Audio normalization]{@link https://github.com/mifi/editly#audio-normalization}
   */
  enable?: boolean;

  /**
   * Normalization algorithm.
   *
   * - `"dynaudnorm"` — dynamic loudness normalization (ffmpeg `dynaudnorm`).
   *   Continuously levels volume across the track. Good for evening out a mix.
   * - `"loudnorm"` — EBU R128 loudness normalization (ffmpeg `loudnorm`),
   *   targeting an integrated loudness in LUFS. Use this to match streaming
   *   platforms (e.g. YouTube normalizes uploads toward ~-14 LUFS).
   *
   * @default "dynaudnorm"
   */
  mode?: "dynaudnorm" | "loudnorm";

  /**
   * Audio normalization gauss size. Only used when `mode` is `"dynaudnorm"`.
   *
   * @default 5
   * @see [Audio normalization]{@link https://github.com/mifi/editly#audio-normalization}
   */
  gaussSize?: number;

  /**
   * Audio normalization max gain. Only used when `mode` is `"dynaudnorm"`.
   *
   * @default 30
   * @see [Audio normalization]{@link https://github.com/mifi/editly#audio-normalization}
   */
  maxGain?: number;

  /**
   * Integrated loudness target in LUFS (loudnorm `I`).
   * Only used when `mode` is `"loudnorm"`.
   *
   * @default -14
   */
  targetLufs?: number;

  /**
   * True-peak ceiling in dBTP (loudnorm `TP`).
   * Only used when `mode` is `"loudnorm"`.
   *
   * @default -1
   */
  truePeakDb?: number;

  /**
   * Loudness range in LU (loudnorm `LRA`).
   * Only used when `mode` is `"loudnorm"`.
   *
   * @default 7
   */
  loudnessRange?: number;
}

export interface RenderSingleFrameConfig extends ConfigurationOptions {
  /**
   * Output path (`.mp4` or `.mkv`, can also be a `.gif`).
   */
  outPath: string;

  /**
   * Timestamp to render.
   */
  time?: number;
}

// Internal types

export type Keyframe = {
  t: number;
  props: { [key: string]: number };
};
