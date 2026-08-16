import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { requireSession } from "@/lib/auth/session";
import { sniffImage } from "@/lib/service-reports/image";
import {
  MAX_PHOTO_BYTES,
  PHOTO_ASSET_DIR,
  type PhotoMimeType,
} from "@/lib/service-reports/report";

/**
 * Receives one site photograph and writes it under `public/assets`, returning
 * the path the report will store.
 *
 * Uploading here rather than with the form is what lets the report hold a *link*
 * to each photograph: by the time the form is submitted every image is already a
 * file on disk and a path in the editor's state. It also means a twenty-photo
 * report is twenty small requests rather than one large one, so a failure costs
 * a single retry and the Server Action body stays small.
 *
 * Three things worth knowing about this design:
 *
 * 1. **Files under `public/` are served without authentication.** Anyone holding
 *    the path can fetch the image, and these are photographs of a client's
 *    premises. The uuid filename is obscurity, not a control.
 * 2. **Abandoning the form leaves the file behind.** The upload happens before
 *    the report is saved, so a cancelled edit orphans whatever it uploaded.
 *    Nothing collects those; it is the accepted cost of storing links.
 * 3. **This needs a writable filesystem.** It works under `next dev` and under
 *    `next start` on an ordinary server. On a read-only or ephemeral filesystem
 *    — Vercel's lambdas, most container platforms — the write fails, and files
 *    written after a build are not part of the build's static output anyway.
 */
export const dynamic = "force-dynamic";

/** The extension to save under, chosen from the sniffed type rather than the name. */
const EXTENSION: Record<PhotoMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  await requireSession();

  const form = await request.formData();
  const file = form.get("photo");

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "No photo was uploaded." }, { status: 400 });
  }

  if (file.size > MAX_PHOTO_BYTES) {
    return Response.json(
      { error: "That photo is too large even after resizing." },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  /*
   * The format is read from the bytes, never from `File.type` — the browser sets
   * that from the extension and the uploader controls it outright. This is what
   * decides the extension the file is saved under, so a document renamed to
   * `.jpg` is refused here rather than written into a public directory.
   */
  const mimeType = sniffImage(bytes);

  if (!mimeType) {
    return Response.json(
      { error: "That file is not a JPEG, PNG or WebP image." },
      { status: 415 },
    );
  }

  // A generated name, so an upload can never overwrite an existing asset or
  // choose its own path out of the directory.
  const name = `${randomUUID()}.${EXTENSION[mimeType]}`;
  const directory = join(process.cwd(), "public", PHOTO_ASSET_DIR);

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, name), bytes);
  } catch (cause) {
    console.error("[service-reports] photo upload failed", cause);
    return Response.json(
      { error: "Could not save that photo. Please try again." },
      { status: 500 },
    );
  }

  return Response.json({ src: `/${PHOTO_ASSET_DIR}/${name}` });
}
