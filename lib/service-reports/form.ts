/**
 * Parsing and validation for the service-report add/edit form.
 *
 * Pure and free of Next.js / database imports so it can be unit tested and
 * shared between the Server Actions and any client-side pre-checks — the same
 * split `lib/certificates/form.ts` uses.
 */

// Relative, not `@/`: this module is unit tested, and the vitest config
// resolves no path alias — see the same import in `lib/activity/format.ts`.
import { parseQuoteDate } from "../quotations/dates";
import {
  CHECKLIST_ITEMS,
  MAX_PHOTOS_PER_PLATE,
  MAX_PHOTOS_PER_REPORT,
  MAX_PLATES,
  isBlankLine,
  isChecklistMark,
  isSafePhotoSrc,
  toLineSeverity,
  toPanelType,
  toServiceReportKind,
  type PanelType,
  type ServiceReportChecklist,
  type ServiceReportEquipment,
  type ServiceReportKind,
  type ServiceReportLine,
} from "./report";

/** Field names, kept in one place so the form and parser cannot drift apart. */
export const FIELD = {
  id: "id",
  kind: "kind",
  customerName: "customerName",
  address: "address",
  projectTitle: "projectTitle",
  systemDescription: "systemDescription",
  serviceDate: "serviceDate",
  panelType: "panelType",
  otherEquipment: "otherEquipment",
  servicedByName: "servicedByName",
  servicedByTitle: "servicedByTitle",
  notedByName: "notedByName",

  /*
   * Repeated once per row, in document order — `FormData.getAll` preserves it,
   * which is what keeps the six equipment columns lined up with each other. Same
   * arrangement `lib/quotations/form.ts` uses for line items.
   */
  equipmentModel: "equipment.model",
  equipmentBrand: "equipment.brand",
  equipmentLocation: "equipment.location",
  equipmentDetectors: "equipment.detectors",
  equipmentManualPulls: "equipment.manualPulls",
  equipmentBellsStrobes: "equipment.bellsStrobes",

  lineAction: "line.action",
  lineFinding: "line.finding",
  lineSeverity: "line.severity",

  recommendation: "recommendation",

  /* ---- Photo report ---- */

  finding: "finding",
  activity: "activity",

  /**
   * The plates, as two parallel repeated fields — one entry per plate, in
   * document order.
   *
   * `platePhotos` is a JSON array of the plate's image paths. JSON rather than a
   * separator because `FormData` cannot nest and a path is free text: a
   * comma-joined list would break on the first filename containing a comma, and
   * quietly, by splitting one photograph into two broken ones.
   *
   * The files themselves are uploaded before the form is submitted — see the
   * upload route — so by the time this is parsed every photograph is already a
   * path, and a plate that was edited looks no different from one that was not.
   */
  plateCaption: "plate.caption",
  platePhotos: "plate.photos",
} as const;

/**
 * The checklist arrives as one radio group per item, named for the item. Kept
 * as a function rather than in `FIELD` because the names are generated from
 * `CHECKLIST_ITEMS` rather than written out.
 */
export function checklistFieldName(key: string): string {
  return `check.${key}`;
}

export type ServiceReportFormErrors = {
  customerName?: string;
  address?: string;
  projectTitle?: string;
  systemDescription?: string;
  serviceDate?: string;
  otherEquipment?: string;
  servicedByName?: string;
  servicedByTitle?: string;
  notedByName?: string;
  /** Set when a repeating section is over its ceiling; names the section. */
  equipment?: string;
  lines?: string;
  recommendations?: string;
  findings?: string;
  activities?: string;
  plates?: string;
};

/** One plate as submitted: its caption and the paths of its photographs. */
export type PlateInput = {
  caption: string;
  /** Site-relative paths under `/assets/`, in the order they are printed. */
  photos: string[];
};

/** The editable half of a `service_reports` row — everything but the reference. */
export type ServiceReportInput = {
  kind: ServiceReportKind;
  customerName: string;
  address: string;
  projectTitle: string;
  serviceDate: string;

  /* Checklist only; nulled/emptied for a photo report. */
  systemDescription: string | null;
  panelType: PanelType;
  equipment: ServiceReportEquipment[];
  otherEquipment: string | null;
  checklist: ServiceReportChecklist;
  lines: ServiceReportLine[];

  /* Photo report only; emptied for a checklist. */
  findings: string[];
  activities: string[];
  plates: PlateInput[];

  recommendations: string[];
  servicedByName: string | null;
  servicedByTitle: string | null;
  notedByName: string | null;
};

/**
 * The trimmed submission as typed, for re-seeding a rejected form.
 *
 * The scalar fields are echoed as strings; the four repeating sections are
 * echoed in their parsed shape, because that is what the client component holds
 * in state and re-renders from.
 */
export type ServiceReportFormValues = {
  kind: ServiceReportKind;
  customerName: string;
  address: string;
  projectTitle: string;
  systemDescription: string;
  serviceDate: string;
  panelType: PanelType;
  otherEquipment: string;
  servicedByName: string;
  servicedByTitle: string;
  notedByName: string;
  equipment: ServiceReportEquipment[];
  checklist: ServiceReportChecklist;
  lines: ServiceReportLine[];
  recommendations: string[];
  findings: string[];
  activities: string[];
  /**
   * Echoed whole. Because the photographs are uploaded before the form is
   * submitted, a plate is just a caption and some paths by this point — so
   * unlike a half-finished file upload it survives a rejected submit intact.
   */
  plates: PlateInput[];
};

export type ServiceReportFormState = {
  errors?: ServiceReportFormErrors;
  /** Set when the action failed for a reason unrelated to a single field. */
  formError?: string;
  /**
   * Echoed back so a rejected submit does not wipe what was typed. React resets
   * an uncontrolled form once its action settles, so the fields are re-seeded
   * from here rather than from the row loaded by the page.
   */
  values?: ServiceReportFormValues;
};

export type ParseResult =
  | { ok: true; input: ServiceReportInput; values: ServiceReportFormValues }
  | {
      ok: false;
      errors: ServiceReportFormErrors;
      values: ServiceReportFormValues;
    };

/*
 * Limits match the column types (all `text`, so this is about keeping a pasted
 * document out of the database rather than about fitting the column).
 */
const MAX_CUSTOMER_LENGTH = 200;
const MAX_ADDRESS_LENGTH = 300;
const MAX_PROJECT_LENGTH = 300;
const MAX_SYSTEM_LENGTH = 200;
const MAX_NAME_LENGTH = 160;
const MAX_CELL_LENGTH = 200;
const MAX_LINE_LENGTH = 500;

/*
 * Ceilings on the repeating sections. Generous next to any real sheet — the
 * sample lists one panel, seven rows and three recommendations — and there only
 * to bound what a hand-made submission can insert into a `jsonb` column.
 */
const MAX_EQUIPMENT_ROWS = 20;
const MAX_LINES = 60;
const MAX_RECOMMENDATIONS = 20;
const MAX_BULLETS = 30;
const MAX_CAPTION_LENGTH = 200;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guards ids arriving from a form or a URL before they reach the database —
 * Postgres rejects a malformed uuid with an error rather than an empty result,
 * so checking here is what turns a bad id into a 404.
 */
export function isServiceReportId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Every value submitted under one repeated name, trimmed and in order. */
function column(form: FormData, name: string): string[] {
  return form
    .getAll(name)
    .map((value) => (typeof value === "string" ? value.trim() : ""));
}

/** Collapses a blank optional field to `null` so it reads as "not recorded". */
function nullable(value: string): string | null {
  return value === "" ? null : value;
}

/** `required` plus a length ceiling, the check five of these fields share. */
function checkRequired(
  value: string,
  label: string,
  max: number,
): string | undefined {
  if (!value) return `Enter the ${label}.`;
  if (value.length > max) return `Keep the ${label} under ${max} characters.`;
  return undefined;
}

function checkOptional(
  value: string,
  label: string,
  max: number,
): string | undefined {
  if (value.length > max) return `Keep the ${label} under ${max} characters.`;
  return undefined;
}

/**
 * The equipment table, read from its six parallel columns.
 *
 * The row count is whatever the longest column has, so a submission missing a
 * trailing value still yields a row rather than silently dropping the ones after
 * it. Entirely blank rows are skipped — the editor always keeps a spare row at
 * the bottom — and every cell is clipped rather than rejected, because a cell
 * over the ceiling is a paste accident and losing the whole sheet over one is a
 * worse answer than a truncated model number.
 */
function parseEquipment(form: FormData): ServiceReportEquipment[] {
  const models = column(form, FIELD.equipmentModel);
  const brands = column(form, FIELD.equipmentBrand);
  const locations = column(form, FIELD.equipmentLocation);
  const detectors = column(form, FIELD.equipmentDetectors);
  const manualPulls = column(form, FIELD.equipmentManualPulls);
  const bellsStrobes = column(form, FIELD.equipmentBellsStrobes);

  const count = Math.max(
    models.length,
    brands.length,
    locations.length,
    detectors.length,
    manualPulls.length,
    bellsStrobes.length,
  );

  const cell = (values: string[], index: number) =>
    (values[index] ?? "").slice(0, MAX_CELL_LENGTH);

  const rows: ServiceReportEquipment[] = [];

  for (let index = 0; index < count; index += 1) {
    const row: ServiceReportEquipment = {
      model: cell(models, index),
      brand: cell(brands, index),
      location: cell(locations, index),
      detectors: cell(detectors, index),
      manualPulls: cell(manualPulls, index),
      bellsStrobes: cell(bellsStrobes, index),
    };

    if (Object.values(row).some((value) => value !== "")) rows.push(row);
  }

  return rows;
}

/**
 * The action-taken / findings table, read from its three parallel columns.
 *
 * A row with only one side filled is kept: the sheet uses a left-hand-only row
 * as an area heading and a right-hand-only row to hang a defect underneath it.
 * Only rows blank on both sides are dropped.
 */
function parseLines(form: FormData): ServiceReportLine[] {
  const actions = column(form, FIELD.lineAction);
  const findings = column(form, FIELD.lineFinding);
  const severities = form.getAll(FIELD.lineSeverity);

  const count = Math.max(actions.length, findings.length);
  const rows: ServiceReportLine[] = [];

  for (let index = 0; index < count; index += 1) {
    const line: ServiceReportLine = {
      action: (actions[index] ?? "").slice(0, MAX_LINE_LENGTH),
      finding: (findings[index] ?? "").slice(0, MAX_LINE_LENGTH),
      severity: toLineSeverity(severities[index]),
    };

    if (!isBlankLine(line)) rows.push(line);
  }

  return rows;
}

/**
 * The checklist, read one radio group at a time.
 *
 * Driven by `CHECKLIST_ITEMS` rather than by what was submitted, so a field name
 * that is not one of the thirteen cannot put anything in the map — and an item
 * left unanswered is simply absent, which is what prints as a blank cell.
 */
function parseChecklist(form: FormData): ServiceReportChecklist {
  const marks: ServiceReportChecklist = {};

  for (const item of CHECKLIST_ITEMS) {
    const value = form.get(checklistFieldName(item.key));
    if (isChecklistMark(value)) marks[item.key] = value;
  }

  return marks;
}

/** A bullet list — findings, activities, recommendations — trimmed and clipped. */
function bullets(form: FormData, name: string): string[] {
  return column(form, name)
    .map((value) => value.slice(0, MAX_LINE_LENGTH))
    .filter(Boolean);
}

export type PlateParse = {
  plates: PlateInput[];
  /** Set when the submission is over one of the photo ceilings. */
  error?: string;
};

/**
 * The photo plates.
 *
 * Each plate submits its caption and a JSON array of image paths. Paths that do
 * not pass `isSafePhotoSrc` are dropped rather than stored — the column feeds an
 * `<img src>`, and the one thing it must never carry is a scheme or somebody
 * else's host. A plate left with no usable photographs is dropped too, since it
 * would print a caption over nothing.
 */
function parsePlates(form: FormData): PlateParse {
  const captions = column(form, FIELD.plateCaption);
  const lists = column(form, FIELD.platePhotos);

  const count = Math.max(captions.length, lists.length);

  if (count > MAX_PLATES) {
    return { plates: [], error: `Keep the report to ${MAX_PLATES} plates.` };
  }

  const plates: PlateInput[] = [];

  for (let index = 0; index < count; index += 1) {
    let parsed: unknown;

    try {
      parsed = JSON.parse(lists[index] || "[]");
    } catch {
      // Not JSON at all: the submission did not come from the editor.
      return { plates: [], error: "That upload was not valid. Reload the page." };
    }

    if (!Array.isArray(parsed)) {
      return { plates: [], error: "That upload was not valid. Reload the page." };
    }

    const photos = parsed.filter(isSafePhotoSrc).map((src) => src.trim());

    if (photos.length > MAX_PHOTOS_PER_PLATE) {
      return {
        plates: [],
        error: `Keep each plate to ${MAX_PHOTOS_PER_PLATE} photos.`,
      };
    }

    if (photos.length === 0) continue;

    plates.push({
      caption: (captions[index] ?? "").slice(0, MAX_CAPTION_LENGTH),
      photos,
    });
  }

  const total = plates.reduce((sum, plate) => sum + plate.photos.length, 0);

  if (total > MAX_PHOTOS_PER_REPORT) {
    return {
      plates: [],
      error: `Keep the report to ${MAX_PHOTOS_PER_REPORT} photos.`,
    };
  }

  return { plates };
}

/**
 * Turns submitted form data into a `ServiceReportInput`.
 *
 * Four fields are required of both kinds — customer, address, project and date —
 * because the head of either sheet is a form with those blanks in it, and a
 * report that does not say who it is for, where, or when is not a record of
 * anything. The checklist requires the System line as a fifth; the photo report
 * has no such line. Everything below is optional: a visit that found nothing has
 * no findings and needs no recommendations, and an empty section is a true
 * statement about the visit rather than a gap in the form.
 *
 * Fields the chosen kind does not print are emptied rather than stored, the way
 * `parseCertificateForm` does it: a photo report keeps no equipment table, and a
 * checklist keeps no plates. Unlike a certificate the kind *can* be changed on an
 * edit — the reference does not name the document, and the two are raised for one
 * visit, so switching is a plausible correction rather than a contradiction. The
 * cost is real and worth stating: switching kind discards the other kind's body,
 * photographs included. The form warns before it does that.
 */
export function parseServiceReportForm(form: FormData): ParseResult {
  const errors: ServiceReportFormErrors = {};

  const kind = toServiceReportKind(form.get(FIELD.kind));
  const isPhoto = kind === "photo_report";

  const customerName = text(form, FIELD.customerName);
  const address = text(form, FIELD.address);
  const projectTitle = text(form, FIELD.projectTitle);
  const systemDescription = text(form, FIELD.systemDescription);
  const serviceDate = text(form, FIELD.serviceDate);
  const panelType = toPanelType(form.get(FIELD.panelType));
  const otherEquipment = text(form, FIELD.otherEquipment);
  const servicedByName = text(form, FIELD.servicedByName);
  const servicedByTitle = text(form, FIELD.servicedByTitle);
  const notedByName = text(form, FIELD.notedByName);

  const equipment = isPhoto ? [] : parseEquipment(form);
  const checklist = isPhoto ? {} : parseChecklist(form);
  const lines = isPhoto ? [] : parseLines(form);

  const findings = isPhoto ? bullets(form, FIELD.finding) : [];
  const activities = isPhoto ? bullets(form, FIELD.activity) : [];
  const plateParse = isPhoto ? parsePlates(form) : { plates: [] as PlateInput[] };

  const recommendations = bullets(form, FIELD.recommendation);

  errors.customerName = checkRequired(
    customerName,
    isPhoto ? "client" : "customer",
    MAX_CUSTOMER_LENGTH,
  );
  errors.address = checkRequired(address, "address", MAX_ADDRESS_LENGTH);
  errors.projectTitle = checkRequired(
    projectTitle,
    isPhoto ? "subject" : "project",
    MAX_PROJECT_LENGTH,
  );

  // The System line belongs to the checklist's particulars alone.
  if (!isPhoto) {
    errors.systemDescription = checkRequired(
      systemDescription,
      "system",
      MAX_SYSTEM_LENGTH,
    );
  }

  errors.otherEquipment = checkOptional(
    otherEquipment,
    "other equipment",
    MAX_CELL_LENGTH,
  );
  errors.servicedByName = checkOptional(
    servicedByName,
    "name of who serviced the system",
    MAX_NAME_LENGTH,
  );
  errors.servicedByTitle = checkOptional(
    servicedByTitle,
    "title",
    MAX_NAME_LENGTH,
  );
  errors.notedByName = checkOptional(
    notedByName,
    "owner's representative",
    MAX_NAME_LENGTH,
  );

  // Reused from quotations: same `YYYY-MM-DD` shape, same real-date check, and
  // the same 2000–2100 window that catches a mistyped year.
  const serviced = parseQuoteDate(serviceDate);
  if (!serviced.ok) errors.serviceDate = serviced.error;

  /*
   * Rejected rather than clipped, unlike an over-long cell: a submission past
   * these counts did not come from the editor, and silently keeping the first
   * twenty rows of it would store a report that is not the one submitted.
   */
  if (equipment.length > MAX_EQUIPMENT_ROWS) {
    errors.equipment = `Keep the equipment table to ${MAX_EQUIPMENT_ROWS} rows.`;
  }
  if (lines.length > MAX_LINES) {
    errors.lines = `Keep the findings to ${MAX_LINES} rows.`;
  }
  if (recommendations.length > MAX_RECOMMENDATIONS) {
    errors.recommendations = `Keep the recommendations to ${MAX_RECOMMENDATIONS}.`;
  }
  if (findings.length > MAX_BULLETS) {
    errors.findings = `Keep the findings to ${MAX_BULLETS} lines.`;
  }
  if (activities.length > MAX_BULLETS) {
    errors.activities = `Keep the activities to ${MAX_BULLETS} lines.`;
  }
  if (plateParse.error) errors.plates = plateParse.error;

  const values: ServiceReportFormValues = {
    kind,
    findings,
    activities,
    plates: plateParse.plates,
    customerName,
    address,
    projectTitle,
    systemDescription,
    serviceDate,
    panelType,
    otherEquipment,
    servicedByName,
    servicedByTitle,
    notedByName,
    equipment,
    checklist,
    lines,
    recommendations,
  };

  // The helpers return `undefined` for "fine", so strip those before counting.
  for (const key of Object.keys(errors) as (keyof ServiceReportFormErrors)[]) {
    if (errors[key] === undefined) delete errors[key];
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, values };
  }

  return {
    ok: true,
    values,
    input: {
      kind,
      customerName,
      address,
      projectTitle,
      // Safe: the guard above returns early unless the date parsed.
      serviceDate: serviced.ok ? serviced.date : serviceDate,

      // Checklist only — see the note above about switching kind.
      systemDescription: isPhoto ? null : nullable(systemDescription),
      panelType,
      equipment,
      otherEquipment: isPhoto ? null : nullable(otherEquipment),
      checklist,
      lines,

      // …and these three by the photo report only.
      findings,
      activities,
      plates: plateParse.plates,

      recommendations,
      servicedByName: nullable(servicedByName),
      servicedByTitle: nullable(servicedByTitle),
      notedByName: nullable(notedByName),
    },
  };
}
