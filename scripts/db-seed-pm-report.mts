#!/usr/bin/env tsx
/**
 * Loads the Shoppers Saver Grocery PM Service Report — the photo report the
 * second half of this feature was modelled on — into the dashboard.
 *
 *   npm run db:seed-pm-report [-- --photos <dir>]
 *
 * The prose is transcribed from the source PDF. The photographs are not: they
 * are site photographs that live in the original document rather than in this
 * repository, so the script takes a directory of image files and files them into
 * the plates in the order the sheets print them. Run without `--photos` and the
 * report is created with its captions and no images — which is a useful state in
 * itself, since it is what a report looks like before anybody uploads to it.
 *
 * Not idempotent — each run issues a new reference number. `--reset` removes
 * earlier copies for this client and date only, for the reason set out in
 * `db-seed-service-report.mts`.
 */

import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { requireDirectUrl } from "../db/connection";
import * as schema from "../db/schema";
import { recordActivity } from "../lib/activity/service";
import type { PlateInput, ServiceReportInput } from "../lib/service-reports/form";
import { PHOTO_ASSET_DIR } from "../lib/service-reports/report";
import { createServiceReport } from "../lib/service-reports/service";

const { serviceReports } = schema;

const pool = new Pool({ connectionString: requireDirectUrl() });
const db = drizzle(pool, { schema });

const CLIENT = "SHOPPERS SAVER GROCERY";
const SERVICE_DATE = "2026-08-07";

/**
 * The plates in printed order, with how many photographs each takes.
 *
 * The counts come from the source sheets — one panel shot, then three, three,
 * nine and nine — and are what the `--photos` directory is dealt into. A
 * directory with fewer images simply fills fewer plates; the captions are the
 * part being seeded.
 */
const PLATE_PLAN: { caption: string; photos: number }[] = [
  { caption: "CONVENTIONAL FIRE ALARM CONTROL PANEL (EXISTING CONDITION)", photos: 1 },
  { caption: "FUNCTIONALITY TEST OF THE SYSTEM", photos: 3 },
  { caption: "CLEANING AND INSPECTION OF DEVICES", photos: 3 },
  { caption: "CLEANING AND INSPECTION OF DEVICES", photos: 9 },
  { caption: "CLEANING AND INSPECTION OF DEVICES", photos: 9 },
];

const REPORT: Omit<ServiceReportInput, "plates"> = {
  kind: "photo_report",
  customerName: CLIENT,
  address: "BRGY. BARACA CAMACHILE SUBIC, ZAMBALES",
  projectTitle:
    "ONE-TIME PREVENTIVE MAINTENANCE OF FIRE DETECTION AND ALARM SYSTEM",
  serviceDate: SERVICE_DATE,

  findings: [
    "Batteries were already drained and defective",
    "Two Smoke Detectors were triggered causing fire alarm",
    "All Detectors still have their covers intact",
    "Fire Alarm on the System",
  ],
  activities: [
    "Check and test the voltage reading of the batteries. (Drop Voltage and subject for replacement)",
    "Check and Test the Smoke Detectors with alarms. (Devices were defective)",
    "Conduct Cleaning, Inspection and Testing of each monitoring and alarm devices.",
    "Check and test the condition of the Fire Alarm Panel",
  ],
  recommendations: [
    "Replace the two drained batteries.",
    "Replace all smoke detectors at ground floor with heat detectors to avoid false alarms due to dust accumulation since it is an open area.",
  ],

  // Everything below belongs to the checklist report; see the kind enum.
  systemDescription: null,
  panelType: "conventional",
  equipment: [],
  otherEquipment: null,
  checklist: {},
  lines: [],
  servicedByName: null,
  servicedByTitle: null,
  notedByName: null,
};

/** The asset filename prefix to gather, e.g. `fdas-pm-2026-08-07`. */
const DEFAULT_PREFIX = "fdas-pm-2026-08-07";

function option(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

/**
 * The paths of the report's photographs, as the database stores them.
 *
 * Reads `public/assets` rather than taking bytes: the images are already files
 * there — put there by `npm run extract-pdf-photos` — and what the report holds
 * is a link to each. Sorted by name so the numbered filenames the extractor
 * writes deal into the plates in the order the source sheets print them.
 */
function assetPaths(prefix: string): string[] {
  const directory = join("public", PHOTO_ASSET_DIR);
  const allowed = new Set([".jpg", ".jpeg", ".png", ".webp"]);

  let names: string[];

  try {
    names = readdirSync(directory);
  } catch {
    return [];
  }

  return names
    .filter((name) => name.startsWith(`${prefix}-`))
    .filter((name) => allowed.has(extname(name).toLowerCase()))
    .filter((name) => statSync(join(directory, name)).isFile())
    .sort((a, b) => a.localeCompare(b, "en"))
    .map((name) => `/${PHOTO_ASSET_DIR}/${name}`);
}

try {
  const prefix = option("prefix") ?? DEFAULT_PREFIX;
  const photos = assetPaths(prefix);

  // Deal the photographs into the plates, in plan order.
  let cursor = 0;
  const plates: PlateInput[] = [];

  for (const plan of PLATE_PLAN) {
    const files = photos.slice(cursor, cursor + plan.photos);
    cursor += files.length;

    // A plate with no photographs prints a caption over nothing, so it is
    // dropped — the same rule the form's parser applies.
    if (files.length > 0) plates.push({ caption: plan.caption, photos: files });
  }

  const leftover = photos.length - cursor;

  if (process.argv.includes("--reset")) {
    const removed = await db
      .delete(serviceReports)
      .where(
        and(
          eq(serviceReports.customerName, CLIENT),
          eq(serviceReports.serviceDate, SERVICE_DATE),
          eq(serviceReports.kind, "photo_report"),
        ),
      )
      .returning({ reportNo: serviceReports.reportNo });

    if (removed.length > 0) {
      console.log(
        `  removed ${removed.length} earlier copy/copies: ` +
          removed.map((row) => row.reportNo).join(", "),
      );
    }
  }

  const { id, reportNo } = await createServiceReport(db, { ...REPORT, plates });

  await recordActivity(db, {
    action: "create",
    entity: "service_report",
    entityId: id,
    label: `${reportNo} · ${CLIENT}`,
    detail: "seeded from the source PDF",
  });

  console.log(`\n  ${reportNo}  ${CLIENT}`);
  console.log(
    `  ${REPORT.findings.length} findings · ${REPORT.activities.length} activities · ` +
      `${REPORT.recommendations.length} recommendations`,
  );

  if (photos.length === 0) {
    console.log(
      `\n  No images named ${prefix}-* found in public/${PHOTO_ASSET_DIR},\n` +
        "  so the report has no plates yet. Extract them first:\n" +
        `    npm run extract-pdf-photos -- "<file.pdf>" --prefix ${prefix}`,
    );
  } else {
    console.log(
      `  ${cursor} photo(s) across ${plates.length} plate(s)` +
        (leftover > 0 ? ` — ${leftover} left over, add them in the editor` : ""),
    );
  }

  console.log(`\n  /service-reports/${id}/print\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n✖ Failed: ${message}\n`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
