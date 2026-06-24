import GL from "gl";
import createShader from "gl-shader";
import { readFile } from "node:fs/promises";
import { defineFrameSource } from "../api/index.js";
import type { GlLayer } from "../types.js";

// I have no idea what I'm doing but it works ¯\_(ツ)_/¯

export default defineFrameSource<GlLayer>("gl", async ({ width, height, channels, params }) => {
  const gl = GL(width, height);

  const defaultVertexSrc = `
    attribute vec2 position;
    void main(void) {
      gl_Position = vec4(position, 0.0, 1.0 );
    }
  `;
  const {
    vertexPath,
    fragmentPath,
    vertexSrc: vertexSrcIn,
    fragmentSrc: fragmentSrcIn,
    speed = 1,
  } = params;

  let fragmentSrc = fragmentSrcIn;
  let vertexSrc = vertexSrcIn;

  if (fragmentPath) fragmentSrc = (await readFile(fragmentPath)).toString();
  if (vertexPath) vertexSrc = (await readFile(vertexPath)).toString();

  if (!vertexSrc) vertexSrc = defaultVertexSrc;

  const shader = createShader(gl, vertexSrc, fragmentSrc ?? "");
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // https://blog.mayflower.de/4584-Playing-around-with-pixel-shaders-in-WebGL.html

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);

  async function readNextFrame(progress: number) {
    shader.bind();

    shader.attributes.position.pointer();

    shader.uniforms.resolution = [width, height];
    shader.uniforms.time = progress * speed;

    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

    const upsideDownArray = Buffer.allocUnsafe(width * height * channels);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, upsideDownArray);
    const outArray = Buffer.allocUnsafe(width * height * channels);

    // GL renders bottom-to-top, so flip vertically by copying whole rows in
    // reverse order. Column (and RGBA) order within each row is preserved —
    // the previous per-pixel reversal also mirrored horizontally and read out
    // of bounds for the first pixel.
    const rowBytes = width * channels;
    for (let y = 0; y < height; y += 1) {
      const srcStart = (height - 1 - y) * rowBytes;
      upsideDownArray.copy(outArray, y * rowBytes, srcStart, srcStart + rowBytes);
    }
    return outArray;
  }

  function close() {
    (gl.getExtension("STACKGL_destroy_context") as { destroy(): void } | null)?.destroy();
  }

  return {
    readNextFrame,
    close,
  };
});
