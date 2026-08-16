import { describe, expect, it } from "vitest";

import { sniffImage, toServedContentType } from "./image";

/** A buffer whose first bytes are the given signature. */
function withHeader(bytes: number[], length = 32): Uint8Array {
  const buffer = new Uint8Array(length);
  buffer.set(bytes, 0);
  return buffer;
}

const JPEG = withHeader([0xff, 0xd8, 0xff, 0xe0]);
const PNG = withHeader([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = withHeader([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

describe("sniffImage", () => {
  it("identifies the three formats from their own bytes", () => {
    expect(sniffImage(JPEG)).toBe("image/jpeg");
    expect(sniffImage(PNG)).toBe("image/png");
    expect(sniffImage(WEBP)).toBe("image/webp");
  });

  /*
   * The point of the whole module: the uploader controls `File.type`, and these
   * bytes are handed back out as a Content-Type from our own origin.
   */
  it("rejects a file that is not an image, whatever it was announced as", () => {
    const html = new TextEncoder().encode("<!doctype html><script>alert(1)");

    expect(sniffImage(html)).toBeNull();
  });

  it("rejects SVG, which is markup rather than a photograph", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">');

    expect(sniffImage(svg)).toBeNull();
  });

  it("rejects a file too short to carry a signature", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });

  it("rejects a RIFF container that is not WebP", () => {
    // "RIFF" .... "AVI " — a video, not a photograph.
    const avi = withHeader([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20,
    ]);

    expect(sniffImage(avi)).toBeNull();
  });
});

describe("toServedContentType", () => {
  it("passes through the three types the app stores", () => {
    expect(toServedContentType("image/jpeg")).toBe("image/jpeg");
    expect(toServedContentType("image/webp")).toBe("image/webp");
  });

  it("falls back to a type no browser will execute", () => {
    expect(toServedContentType("text/html")).toBe("application/octet-stream");
    expect(toServedContentType("image/svg+xml")).toBe("application/octet-stream");
    expect(toServedContentType("")).toBe("application/octet-stream");
  });
});
