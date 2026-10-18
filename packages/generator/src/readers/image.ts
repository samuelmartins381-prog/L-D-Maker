// Image helpers for the sources: dimensions read from the file header, and downscaling of the raw
// pixels extracted from PDFs (Claude reads images up to 2576 px on the long edge; more is only weight).

/** Long edge, in pixels, beyond which an image brings Claude nothing more. */
export const MAX_EDGE = 2576;

/** Width and height from a PNG, JPEG, GIF or WebP header; undefined when unreadable. */
export function imageSize(
  data: Uint8Array,
): { width: number; height: number } | undefined {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const ascii = (at: number, n: number) =>
    String.fromCharCode(...data.subarray(at, at + n));
  if (data.length >= 24 && ascii(1, 3) === "PNG")
    return { width: view.getUint32(16), height: view.getUint32(20) };
  if (data.length >= 10 && ascii(0, 3) === "GIF")
    return {
      width: view.getUint16(6, true),
      height: view.getUint16(8, true),
    };
  if (data.length >= 32 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const format = ascii(12, 4);
    if (format === "VP8 ")
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    if (format === "VP8L") {
      const bits = view.getUint32(21, true);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    if (format === "VP8X")
      return {
        width: 1 + (view.getUint32(24, true) & 0xffffff),
        height: 1 + (view.getUint32(27, true) & 0xffffff),
      };
    return undefined;
  }
  if (data[0] === 0xff && data[1] === 0xd8) {
    // JPEG: walk the segments to the first start-of-frame marker.
    let at = 2;
    while (at + 9 < data.length) {
      if (data[at] !== 0xff) return undefined;
      const marker = data[at + 1] as number;
      const length = view.getUint16(at + 2);
      const sof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (sof)
        return {
          width: view.getUint16(at + 7),
          height: view.getUint16(at + 5),
        };
      at += 2 + length;
    }
  }
  return undefined;
}

/** Box-filter downscale so that the long edge is at most `maxEdge`; unchanged when already smaller. */
export function downscale(
  width: number,
  height: number,
  channels: number,
  pixels: Uint8Array,
  maxEdge = MAX_EDGE,
): { width: number; height: number; pixels: Uint8Array } {
  const scale = maxEdge / Math.max(width, height);
  if (scale >= 1) return { width, height, pixels };
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const out = new Uint8Array(w * h * channels);
  const sum = new Float64Array(channels);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * height) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / w));
      sum.fill(0);
      for (let sy = y0; sy < y1; sy++)
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * width + sx) * channels;
          for (let c = 0; c < channels; c++)
            sum[c] = (sum[c] as number) + (pixels[i + c] as number);
        }
      const n = (y1 - y0) * (x1 - x0);
      const o = (y * w + x) * channels;
      for (let c = 0; c < channels; c++)
        out[o + c] = Math.round((sum[c] as number) / n);
    }
  }
  return { width: w, height: h, pixels: out };
}
