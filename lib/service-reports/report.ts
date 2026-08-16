/**
 * What an FDAS service report is made of — the fixed checklists it is scored
 * against, and the shape of the three lists that vary per visit.
 *
 * Pure and free of Next.js / database imports so it can be unit tested and
 * shared by the form, the dashboard and the printed sheet — the same split the
 * other `lib/*` modules use. `db/schema.ts` imports the content types from here
 * for its `jsonb` columns, which inverts the arrangement `ScopeSection` uses
 * (defined in the schema, imported by `lib/`). It is inverted on purpose: the
 * checklist *definitions* have to live in a database-free module to be testable,
 * and putting the types they describe in another file would let the two drift.
 *
 * The checklists themselves are code rather than rows, for the reason the
 * certificate wording is: they are the form, not data entered into it. Every
 * FDAS report is scored against the same thirteen items, so storing them per
 * report would mean thirteen copies per visit and a backfill the first time a
 * line was reworded.
 */

/* -------------------------------------------------------------------------- */
/* Which of the two reports                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The two documents raised after a maintenance visit.
 *
 * `checklist` is the FDAS Maintenance Report — the ruled form scored against the
 * thirteen questions below. `photo_report` is the PM Service Report: findings,
 * activities and recommendations as prose, evidenced by plates of site
 * photographs. They are issued for the *same* visit and go in the same file,
 * which is why they share a table and a numbering series rather than being two
 * features — the same arrangement `certificates` makes for its two documents.
 *
 * `checklist` is the default so the column could be added to a table that
 * already had rows in it without guessing at what they were.
 */
export const SERVICE_REPORT_KINDS = ["checklist", "photo_report"] as const;
export type ServiceReportKind = (typeof SERVICE_REPORT_KINDS)[number];

export const SERVICE_REPORT_KIND_LABEL: Record<ServiceReportKind, string> = {
  checklist: "Maintenance checklist",
  photo_report: "PM photo report",
};

/** Same reasoning as `toPanelType`: an unknown value claims nothing. */
export function toServiceReportKind(value: unknown): ServiceReportKind {
  return SERVICE_REPORT_KINDS.includes(value as ServiceReportKind)
    ? (value as ServiceReportKind)
    : "checklist";
}

/* -------------------------------------------------------------------------- */
/* Photo plates                                                               */
/* -------------------------------------------------------------------------- */

/**
 * What a photograph may be stored as.
 *
 * Three formats rather than "any image/*": the bytes are served back out of our
 * own route with a `Content-Type` we set, and an SVG served that way is a script
 * execution primitive rather than a photograph. Everything a phone camera or a
 * screenshot produces is covered.
 */
export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoMimeType = (typeof PHOTO_MIME_TYPES)[number];

export function isPhotoMimeType(value: unknown): value is PhotoMimeType {
  return (
    typeof value === "string" &&
    (PHOTO_MIME_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Ceilings on a photo report.
 *
 * The browser downscales before uploading (see `lib/service-reports/downscale`),
 * so a photograph arrives at roughly 150KB and these are backstops against a
 * hand-made submission rather than limits a real report meets. They are also
 * what `serverActions.bodySizeLimit` in `next.config.ts` is sized against —
 * raise one and the other has to move with it.
 */
export const MAX_PHOTO_BYTES = 1_500_000;
export const MAX_PHOTOS_PER_REPORT = 40;
export const MAX_PHOTOS_PER_PLATE = 12;
export const MAX_PLATES = 12;

/**
 * The longest edge a photograph is downscaled to before upload.
 *
 * A plate of three prints each photo about 52mm wide. At 300dpi — more than any
 * office laser resolves — that is 615px, so 1600 leaves room to crop or to print
 * one full width and still holds a file to about 150KB. Uploading the phone's
 * 4000px original would put 4MB in the database to print 52mm of paper.
 */
export const PHOTO_MAX_EDGE = 1600;
export const PHOTO_JPEG_QUALITY = 0.75;

/** Where uploaded photographs are written, under `public/`. */
export const PHOTO_ASSET_DIR = "assets";

/**
 * Whether a stored path is one this app is willing to put in an `<img src>`.
 *
 * The column holds a *site-relative path*, never a URL, and this is what keeps
 * it that way. Three things are being refused:
 *
 * - `javascript:` and `data:` — a scheme in an `src` is a script-execution
 *   vector the moment anything renders it without thinking.
 * - `//evil.example/x.jpg` — a protocol-relative URL, which looks like a path
 *   and is not; it would silently load a third party's image into the report.
 * - `..` — traversal, which would let a row point outside the assets directory.
 *
 * Anything failing this is dropped rather than rendered, so a row written by
 * hand cannot turn a printed report into a request to somebody else's server.
 */
export function isSafePhotoSrc(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const src = value.trim();

  return (
    src.startsWith(`/${PHOTO_ASSET_DIR}/`) &&
    !src.includes("..") &&
    // Rejects "/assets//host" — a protocol-relative URL smuggled past the prefix.
    !src.includes("//") &&
    src.length <= 300
  );
}

/** One group of photographs under a shared caption, as the sheet lays them out. */
export type PhotoPlate = {
  /** Printed in a ruled box beneath the photographs, e.g. "FUNCTIONALITY TEST". */
  caption: string;
  /** Site-relative paths under `/assets/`; see `isSafePhotoSrc`. */
  photos: string[];
};

/* -------------------------------------------------------------------------- */
/* Marks                                                                      */
/* -------------------------------------------------------------------------- */

/** Mirrors the legend printed under the checklist. */
export const CHECKLIST_MARKS = ["pass", "service", "na"] as const;
export type ChecklistMark = (typeof CHECKLIST_MARKS)[number];

/** As drawn in the checklist column, matching the original sheet's glyphs. */
export const MARK_GLYPH: Record<ChecklistMark, string> = {
  pass: "√",
  service: "X",
  na: "NA",
};

/** The legend's own wording, reused as the form's radio labels. */
export const MARK_LABEL: Record<ChecklistMark, string> = {
  pass: "Passes inspection",
  service: "Requires service",
  na: "Not applicable",
};

export function isChecklistMark(value: unknown): value is ChecklistMark {
  return (
    typeof value === "string" &&
    (CHECKLIST_MARKS as readonly string[]).includes(value)
  );
}

/* -------------------------------------------------------------------------- */
/* The two fixed checklists                                                   */
/* -------------------------------------------------------------------------- */

export type ChecklistItem = {
  /**
   * Stored as the key of the checklist map, so it must never change once a
   * report has been saved against it — a renamed key reads back as an unmarked
   * item. The printed wording is `label`/`description`, which may be reworded
   * freely.
   */
  key: string;
  label: string;
  /**
   * The right-hand column of the supervisory table: what the mark is asserting.
   * The panel-inspection items are questions and carry none.
   */
  description?: string;
};

/**
 * "Alarm Panel Supervisory Function" — the six fault conditions the panel is
 * meant to notice on its own. Each is a statement, and the mark says whether the
 * panel lived up to it.
 */
export const SUPERVISORY_FUNCTIONS: readonly ChecklistItem[] = [
  {
    key: "panel_ac_power_loss",
    label: "Panel AC Power Loss",
    description:
      "Loss of AC power to the alarm panel is detected by the alarm system.",
  },
  {
    key: "panel_secondary_power_loss",
    label: "Panel Secondary Power Loss",
    description:
      "Loss of Secondary power to the alarm panel is detected by the alarm system.",
  },
  {
    key: "open_alarm_circuits",
    label: "Open Alarm Circuits",
    description:
      "Electrical opens in initiating and indicating circuits are detected.",
  },
  {
    key: "short_alarm_circuits",
    label: "Short Alarm Circuits",
    description:
      "Electrical shorts in initiating and indicating circuits are detected.",
  },
  {
    key: "panel_to_panel_circuits",
    label: "Panel to Panel Circuits",
    description:
      "Integrity of single or multiple circuits providing interface between two or more control panels verified.",
  },
  {
    key: "ground_faults_detected",
    label: "Ground Faults Detected",
    description: "Ground faults in alarm and power circuit are detected.",
  },
] as const;

/**
 * "Panel Inspection" — the seven questions asked of the panel and its
 * surroundings. Written as questions on the original sheet, so they are kept as
 * questions here: a mark against "Are zones labeled and identified?" reads
 * unambiguously in a way a mark against "Zone labelling" would not.
 */
export const PANEL_INSPECTION: readonly ChecklistItem[] = [
  { key: "in_operation_on_arrival", label: "System was in operation upon arrival?" },
  {
    key: "equipment_secured",
    label:
      "Panel and surrounding equipment, conduit and wiring well secured and in good condition?",
  },
  { key: "lamps_and_displays", label: "Are all lamps and displays operating correct?" },
  {
    key: "primary_power_full_load",
    label: "Primary power supply operates properly under full load?",
  },
  {
    key: "drawings_available",
    label: "Are drawings and wiring diagrams available at the panel?",
  },
  {
    key: "instructions_posted",
    label: "Are operating instructions posted or available at the panel?",
  },
  { key: "zones_labelled", label: "Are zones labeled and identified?" },
] as const;

/** Both groups, in printed order — what the form iterates and the parser reads. */
export const CHECKLIST_GROUPS: readonly {
  title: string;
  items: readonly ChecklistItem[];
}[] = [
  { title: "Alarm Panel Supervisory Function", items: SUPERVISORY_FUNCTIONS },
  { title: "Panel Inspection", items: PANEL_INSPECTION },
] as const;

export const CHECKLIST_ITEMS: readonly ChecklistItem[] = [
  ...SUPERVISORY_FUNCTIONS,
  ...PANEL_INSPECTION,
];

/**
 * The marks recorded for one visit, keyed by `ChecklistItem.key`.
 *
 * Deliberately partial. An item nobody marked is *absent* rather than defaulted,
 * and prints as an empty cell — the way an unfilled box on the paper form looks.
 * A default of "passes inspection" would be the alternative, and it would have
 * the report assert that something was tested and found sound when it was not
 * looked at, which is the one thing an inspection sheet must never do.
 */
export type ServiceReportChecklist = Partial<Record<string, ChecklistMark>>;

/**
 * Reads a stored checklist back, dropping anything unrecognised.
 *
 * `jsonb` is only as trustworthy as everything that has ever written to it — a
 * seed script, a hand-run `UPDATE`, an item key retired in a later release — and
 * an unknown mark reaching the printed sheet would render as nothing useful.
 * Filtering to the items that still exist means a retired key disappears from
 * the sheet rather than lingering as an orphan row.
 */
export function normalizeChecklist(raw: unknown): ServiceReportChecklist {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};

  const source = raw as Record<string, unknown>;
  const marks: ServiceReportChecklist = {};

  for (const item of CHECKLIST_ITEMS) {
    const mark = source[item.key];
    if (isChecklistMark(mark)) marks[item.key] = mark;
  }

  return marks;
}

/* -------------------------------------------------------------------------- */
/* Equipment serviced                                                         */
/* -------------------------------------------------------------------------- */

/**
 * One row of the equipment table.
 *
 * The three counts are text rather than integers because the original sheet
 * writes them with their units and their abbreviations — "SD - 16 Units",
 * "2 UNITS" — and that string is the answer the technician gives. Parsing it
 * into a number would mean printing something the technician did not write, and
 * would have nowhere to put the "SD -" that says which kind of detector was
 * counted.
 */
export type ServiceReportEquipment = {
  model: string;
  brand: string;
  location: string;
  detectors: string;
  manualPulls: string;
  bellsStrobes: string;
};

/** Whether the panel addresses its devices individually or by zone. */
export const PANEL_TYPES = ["conventional", "addressable"] as const;
export type PanelType = (typeof PANEL_TYPES)[number];

export const PANEL_TYPE_LABEL: Record<PanelType, string> = {
  conventional: "Conventional",
  addressable: "Addressable",
};

/** Same reasoning as `isChecklistMark`: an unknown value claims nothing. */
export function toPanelType(value: unknown): PanelType {
  return PANEL_TYPES.includes(value as PanelType)
    ? (value as PanelType)
    : "conventional";
}

/* -------------------------------------------------------------------------- */
/* Action taken / findings                                                    */
/* -------------------------------------------------------------------------- */

/**
 * `defect` is what the original sheet writes in red: something that was found
 * wrong, as against a heading or a statement of what was serviced.
 */
export const LINE_SEVERITIES = ["note", "defect"] as const;
export type LineSeverity = (typeof LINE_SEVERITIES)[number];

export function toLineSeverity(value: unknown): LineSeverity {
  return value === "defect" ? "defect" : "note";
}

/**
 * One row of the two-column "Action Taken / Findings" table.
 *
 * Both sides are optional and rows with something on one side only are ordinary:
 * the sheet uses a left-hand-only row as a heading ("A. Ground Floor: (Zone 1)")
 * and a right-hand-only row to hang a defect under the area above it. So a row
 * is dropped only when *both* sides are blank.
 */
export type ServiceReportLine = {
  action: string;
  finding: string;
  severity: LineSeverity;
};

export function isBlankLine(line: ServiceReportLine): boolean {
  return line.action === "" && line.finding === "";
}

/**
 * Reads a stored list back. Same reasoning as `normalizeChecklist`: the column
 * is `jsonb`, so the rows are shaped by whatever last wrote them.
 */
export function normalizeLines(raw: unknown): ServiceReportLine[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      return {
        action: typeof row.action === "string" ? row.action : "",
        finding: typeof row.finding === "string" ? row.finding : "",
        severity: toLineSeverity(row.severity),
      };
    })
    .filter((line) => !isBlankLine(line));
}

/** As above, for the equipment table. */
export function normalizeEquipment(raw: unknown): ServiceReportEquipment[] {
  if (!Array.isArray(raw)) return [];

  const string = (value: unknown) => (typeof value === "string" ? value : "");

  return raw
    .map((entry) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      return {
        model: string(row.model),
        brand: string(row.brand),
        location: string(row.location),
        detectors: string(row.detectors),
        manualPulls: string(row.manualPulls),
        bellsStrobes: string(row.bellsStrobes),
      };
    })
    .filter((row) => Object.values(row).some((value) => value !== ""));
}

/** As above, for the recommendations. */
export function normalizeRecommendations(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}
