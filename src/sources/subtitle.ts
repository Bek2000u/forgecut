import { Rect, Textbox } from "fabric/node";
import { defineFrameSource } from "../api/index.js";
import { activeWordAt, computeWordRanges, joinWords, popKeyframe } from "../core/subtitle-words.js";
import { easeOutExpo } from "../easings.js";
import type { SubtitleLayer } from "../types.js";
import { defaultFontFamily } from "../util.js";

export default defineFrameSource<SubtitleLayer>("subtitle", async ({ width, height, params }) => {
  const {
    text,
    textColor = "#ffffff",
    backgroundColor = "rgba(0,0,0,0.3)",
    fontFamily = defaultFontFamily,
    delay = 0,
    speed = 1,
    words,
    activeColor = "#ffe000",
    fontSize: fontSizeOverride,
    strokeColor,
    strokeWidth = 0,
    position = "bottom",
    maxWidth = 0.9,
    karaokeStyle = "highlight",
    popInDuration = 0.15,
    popScale = 0.7,
  } = params;

  const min = Math.min(width, height);
  const padding = 0.05 * min;
  const fontSize = fontSizeOverride ?? min / 20;

  const strokeProps =
    strokeWidth > 0 && strokeColor
      ? { stroke: strokeColor, strokeWidth, paintFirst: "stroke" as const }
      : {};

  // Resolve the vertical anchor used by the karaoke renderer.
  const anchor =
    position === "top"
      ? { originY: "top" as const, top: padding }
      : position === "center"
        ? { originY: "center" as const, top: height / 2 }
        : { originY: "bottom" as const, top: height - padding };

  return {
    async readNextFrame(progress, canvas, time) {
      // Single-word karaoke: show only the spoken word, centered, with a pop-in.
      if (words && words.length > 0 && karaokeStyle === "single-word") {
        const current = activeWordAt(words, time);
        if (!current) return; // gap between words — draw nothing

        const { scale, opacity } = popKeyframe(current.elapsed, popInDuration, popScale);

        const textBox = new Textbox(current.word.word, {
          fill: textColor,
          fontFamily,
          fontSize: fontSize * scale,
          textAlign: "center",
          width: width * maxWidth,
          originX: "center",
          originY: anchor.originY,
          left: width / 2,
          top: anchor.top,
          opacity,
          ...strokeProps,
        });

        canvas.add(textBox);
        return;
      }

      // Karaoke mode: show the whole caption and highlight the spoken word.
      if (words && words.length > 0) {
        const textBox = new Textbox(joinWords(words), {
          fill: textColor,
          fontFamily,
          fontSize,
          textAlign: "center",
          width: width * maxWidth,
          originX: "center",
          left: width / 2,
          ...anchor,
          ...strokeProps,
        });

        for (const range of computeWordRanges(words, time)) {
          if (range.active) {
            textBox.setSelectionStyles({ fill: activeColor }, range.startChar, range.endChar);
          }
        }

        if (backgroundColor) {
          const boxHeight = textBox.height ?? fontSize;
          const centerY =
            anchor.originY === "top"
              ? anchor.top + boxHeight / 2
              : anchor.originY === "center"
                ? anchor.top
                : anchor.top - boxHeight / 2;

          canvas.add(
            new Rect({
              width,
              height: boxHeight + padding * 2,
              left: width / 2,
              top: centerY,
              originX: "center",
              originY: "center",
              fill: backgroundColor,
            }),
          );
        }

        canvas.add(textBox);
        return;
      }

      // Plain single-line caption with a fade/slide-in (original behavior).
      const easedProgress = easeOutExpo(Math.max(0, Math.min((progress - delay) * speed, 1)));

      const textBox = new Textbox(text, {
        fill: textColor,
        fontFamily,
        fontSize,
        textAlign: "left",
        width: width - padding * 2,
        originX: "center",
        originY: "bottom",
        left: width / 2 + (-1 + easedProgress) * padding,
        top: height - padding,
        opacity: easedProgress,
        ...strokeProps,
      });

      const rect = new Rect({
        left: 0,
        width,
        height: textBox.height + padding * 2,
        top: height,
        originY: "bottom",
        fill: backgroundColor,
        opacity: easedProgress,
      });

      canvas.add(rect);
      canvas.add(textBox);
    },
  };
});
