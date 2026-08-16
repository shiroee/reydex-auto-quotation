/**
 * Shrinking a photograph in the browser, before it is uploaded.
 *
 * This is what makes storing the images in Postgres reasonable. A phone camera
 * produces a 4000px, 4MB JPEG; the same photograph prints about 52mm wide in a
 * plate of three. Uploading the original would put four megabytes in the
 * database, spend a minute of a site technician's mobile data, and print
 * identically. At `PHOTO_MAX_EDGE` the file lands around 150KB.
 *
 * Browser-only — it uses `createImageBitmap` and a canvas — so it is imported by
 * the client form alone and has no test here; the vitest suite runs in `node`.
 * The server never trusts what this produces: `sniffImage` re-identifies the
 * bytes and `MAX_PHOTO_BYTES` bounds them.
 */

import {
  PHOTO_JPEG_QUALITY,
  PHOTO_MAX_EDGE,
  isPhotoMimeType,
} from "./report";

/** What the picker hands back for one chosen file. */
export type PreparedPhoto = {
  /** Re-encoded, ready to append to the form's `FormData`. */
  file: File;
  /** `URL.createObjectURL` handle for the thumbnail; revoke when discarded. */
  previewUrl: string;
};

/**
 * Re-encodes one file to fit within `PHOTO_MAX_EDGE`, as JPEG.
 *
 * Always JPEG, whatever came in. These are photographs of equipment, so PNG
 * costs several times the bytes for no visible gain, and normalising the output
 * means one format to serve and one to reason about. Transparency is lost, which
 * a photograph does not have.
 *
 * Returns `null` for anything the browser cannot decode as an image, which is
 * the honest answer for a file picked by mistake — the caller reports it rather
 * than uploading something that will be rejected server-side anyway.
 */
export async function downscalePhoto(file: File): Promise<PreparedPhoto | null> {
  // Cheap pre-check so a picked PDF fails here rather than in `createImageBitmap`.
  if (!file.type.startsWith("image/")) return null;

  let bitmap: ImageBitmap;

  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  try {
    const scale = Math.min(
      1,
      PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
    );

    // `round`, and floored at 1: a canvas of zero width throws.
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return null;

    /*
     * White beneath, because the output is JPEG and has no alpha: a transparent
     * PNG would otherwise composite onto black and come out as a dark rectangle.
     */
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", PHOTO_JPEG_QUALITY);
    });

    if (!blob) return null;

    return {
      file: new File([blob], toJpegName(file.name), { type: "image/jpeg" }),
      previewUrl: URL.createObjectURL(blob),
    };
  } finally {
    // Frees the decoded frame rather than waiting for a collection that may not
    // come before the next twenty photographs are decoded.
    bitmap.close();
  }
}

/** `IMG_0421.HEIC` → `IMG_0421.jpg`, so the name matches what is inside it. */
function toJpegName(name: string): string {
  const stem = name.replace(/\.[^.]+$/, "") || "photo";
  return `${stem}.jpg`;
}

/** True when a stored photograph's type is one the app is willing to serve. */
export { isPhotoMimeType };
