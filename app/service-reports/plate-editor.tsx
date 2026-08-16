"use client";

import { useState } from "react";
import { LuImagePlus, LuPlus, LuX } from "react-icons/lu";

import { downscalePhoto } from "@/lib/service-reports/downscale";
import { FIELD } from "@/lib/service-reports/form";
import {
  MAX_PHOTOS_PER_PLATE,
  MAX_PHOTOS_PER_REPORT,
  MAX_PLATES,
} from "@/lib/service-reports/report";

/**
 * The photo-plate editor for a PM service report.
 *
 * Each plate is a caption and an ordered list of image paths. Photographs are
 * uploaded the moment they are picked — downscaled in the browser, posted to the
 * upload route, and replaced in state by the path it returns — so by the time
 * the form is submitted there are no files left to send, only text. That is what
 * makes a plate survive a rejected submit unchanged, and what keeps a
 * twenty-photo report from being one enormous form post.
 *
 * The cost, which is worth being plain about: an upload happens before the
 * report is saved, so abandoning the form leaves the uploaded files on disk with
 * nothing pointing at them.
 */

export type PlateDraft = {
  /** Stable React key; not submitted. */
  key: number;
  caption: string;
  /** Site-relative paths under `/assets/`, in printed order. */
  photos: string[];
};

let nextKey = 1;

export function blankPlate(caption = ""): PlateDraft {
  return { key: nextKey++, caption, photos: [] };
}

export function platesFromRecord(
  plates: { caption: string; photos: string[] }[],
): PlateDraft[] {
  return plates.map((plate) => ({
    key: nextKey++,
    caption: plate.caption,
    photos: [...plate.photos],
  }));
}

/** Posts one prepared image and returns the path it was stored at. */
async function upload(file: File): Promise<string | null> {
  const body = new FormData();
  body.set("photo", file);

  try {
    const response = await fetch("/api/service-reports/photos", {
      method: "POST",
      body,
    });

    if (!response.ok) return null;

    const result: unknown = await response.json();

    return typeof result === "object" &&
      result !== null &&
      typeof (result as { src?: unknown }).src === "string"
      ? (result as { src: string }).src
      : null;
  } catch {
    // Offline, or the request was cut off mid-upload.
    return null;
  }
}

export function PlateEditor({
  plates,
  setPlates,
  error,
}: {
  plates: PlateDraft[];
  setPlates: React.Dispatch<React.SetStateAction<PlateDraft[]>>;
  error?: string;
}) {
  /** How many of the current batch are still being resized and uploaded. */
  const [busy, setBusy] = useState(0);
  /** Files that could not be read or would not upload, named so they can be retried. */
  const [failed, setFailed] = useState<string[]>([]);

  const total = plates.reduce((sum, plate) => sum + plate.photos.length, 0);

  async function addFiles(plateKey: number, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const picked = Array.from(fileList);

    setFailed([]);
    setBusy((count) => count + picked.length);

    for (const file of picked) {
      const prepared = await downscalePhoto(file);
      const src = prepared ? await upload(prepared.file) : null;

      // The preview is not needed once the file has a path of its own.
      if (prepared) URL.revokeObjectURL(prepared.previewUrl);

      if (!src) {
        setFailed((names) => [...names, file.name]);
      } else {
        /*
         * Appended one at a time rather than in a batch, so a slow upload shows
         * its photographs arriving instead of nothing until the last one lands.
         * The room check is inside the updater so it sees the current state.
         */
        setPlates((current) =>
          current.map((plate) =>
            plate.key === plateKey &&
            plate.photos.length < MAX_PHOTOS_PER_PLATE
              ? { ...plate, photos: [...plate.photos, src] }
              : plate,
          ),
        );
      }

      setBusy((count) => count - 1);
    }
  }

  function removePhoto(plateKey: number, src: string) {
    setPlates((current) =>
      current.map((plate) =>
        plate.key === plateKey
          ? { ...plate, photos: plate.photos.filter((path) => path !== src) }
          : plate,
      ),
    );
  }

  return (
    <>
      <div aria-live="polite" aria-atomic="true">
        {error ? (
          <p role="alert" className="mb-3 text-xs text-red-300">
            {error}
          </p>
        ) : null}
        {failed.length > 0 ? (
          <p role="alert" className="mb-3 text-xs text-red-300">
            Could not upload {failed.join(", ")} — try again.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        {plates.map((plate, index) => (
          <div
            key={plate.key}
            className="rounded-xl border border-gold-500/12 p-3.5"
          >
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-wider text-gold-100/35">
                Plate {index + 1} · {plate.photos.length}/{MAX_PHOTOS_PER_PLATE}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPlates((current) =>
                    current.filter((row) => row.key !== plate.key),
                  )
                }
                aria-label={`Remove plate ${index + 1}`}
                className="inline-flex size-7 items-center justify-center rounded-md text-gold-100/35 transition-colors hover:text-red-300"
              >
                <LuX aria-hidden className="size-3.5" />
              </button>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wider text-gold-100/40">
                Caption
              </span>
              <input
                name={FIELD.plateCaption}
                value={plate.caption}
                onChange={(event) =>
                  setPlates((current) =>
                    current.map((row) =>
                      row.key === plate.key
                        ? { ...row, caption: event.target.value }
                        : row,
                    ),
                  )
                }
                placeholder="CLEANING AND INSPECTION OF DEVICES"
                className="reydex-field w-full min-w-0 rounded-lg px-3 py-2.5 text-[0.95rem] text-gold-50 placeholder:text-gold-100/25"
              />
            </label>

            {plate.photos.length > 0 ? (
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {plate.photos.map((src) => (
                  <li
                    key={src}
                    className="relative aspect-square overflow-hidden rounded-lg border border-gold-500/15"
                  >
                    {/* Static files under `public/`; next/image would only
                        re-encode what the browser already downscaled. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="size-full object-cover" />

                    <button
                      type="button"
                      onClick={() => removePhoto(plate.key, src)}
                      aria-label="Remove this photo"
                      className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-md bg-black/70 text-gold-100/80 transition-colors hover:text-red-300"
                    >
                      <LuX aria-hidden className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <label className="mt-3 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-gold-500/25 px-3 text-xs font-medium text-gold-100/70 transition-colors hover:border-gold-400/45 hover:text-gold-100">
              <LuImagePlus aria-hidden className="size-3.5" />
              {busy > 0 ? `Uploading ${busy}…` : "Add photos"}
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={
                  busy > 0 || plate.photos.length >= MAX_PHOTOS_PER_PLATE
                }
                onChange={(event) => {
                  void addFiles(plate.key, event.target.files);
                  // Cleared so picking the same file twice still fires a change.
                  event.target.value = "";
                }}
                className="sr-only"
              />
            </label>

            {/*
             * What travels with the form: the plate's paths as JSON. See the
             * note on `FIELD.platePhotos` for why not a joined string.
             */}
            <input
              type="hidden"
              name={FIELD.platePhotos}
              value={JSON.stringify(plate.photos)}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={plates.length >= MAX_PLATES}
          onClick={() => setPlates((current) => [...current, blankPlate()])}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gold-500/25 px-3 text-xs font-medium text-gold-100/70 transition-colors hover:border-gold-400/45 hover:text-gold-100 disabled:opacity-40"
        >
          <LuPlus aria-hidden className="size-3.5" />
          Add a plate
        </button>

        <span
          className={`text-xs ${
            total > MAX_PHOTOS_PER_REPORT ? "text-red-300" : "text-gold-100/35"
          }`}
        >
          {total} of {MAX_PHOTOS_PER_REPORT} photos
        </span>
      </div>
    </>
  );
}
