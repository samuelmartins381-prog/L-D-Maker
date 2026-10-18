import { describe, expect, it } from "vitest";
import { downscale, imageSize, MAX_EDGE } from "./image.ts";
import { encodePng } from "./png.ts";

describe("imageSize", () => {
  it("reads PNG, JPEG and GIF headers", () => {
    expect(imageSize(encodePng(3, 2, 1, new Uint8Array(6)))).toEqual({
      width: 3,
      height: 2,
    });
    // JPEG: SOI, an APP0 segment, then SOF0 (height 480, width 640).
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11,
      0x08, 0x01, 0xe0, 0x02, 0x80, 0x03,
    ]);
    expect(imageSize(jpeg)).toEqual({ width: 640, height: 480 });
    const gif = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x10, 0x00, 0x20, 0x00,
    ]);
    expect(imageSize(gif)).toEqual({ width: 16, height: 32 });
    expect(imageSize(new Uint8Array([1, 2, 3]))).toBeUndefined();
  });
});

describe("downscale", () => {
  it("brings the long edge to the limit and averages the pixels", () => {
    const width = MAX_EDGE * 2;
    const height = 4;
    const pixels = new Uint8Array(width * height);
    for (let i = 0; i < pixels.length; i += 2) pixels[i] = 200; // 200, 0, 200, 0…
    const small = downscale(width, height, 1, pixels);
    expect(small.width).toBe(MAX_EDGE);
    expect(small.height).toBe(2);
    expect(small.pixels.every((p) => p === 100)).toBe(true);
  });

  it("leaves small images untouched", () => {
    const pixels = new Uint8Array(12);
    expect(downscale(2, 2, 3, pixels).pixels).toBe(pixels);
  });
});
