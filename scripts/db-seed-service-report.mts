#!/usr/bin/env tsx
/**
 * Loads the Shoppers Saver Grocery FDAS maintenance report — the sheet the
 * service-report feature was modelled on — into the dashboard.
 *
 *   npm run db:seed-service-report
 *
 * Like `db-seed-samples.mts` this doubles as an end-to-end check on the model:
 * if the printed sheet matches the original PDF, then the particulars, the
 * equipment table, both checklists, the findings and the recommendations all
 * line up. The checklist tally below is read off the source document and
 * asserted after the insert.
 *
 * Not idempotent — each run issues a new reference number, the same as raising a
 * fresh report. Pass --reset to remove earlier copies first.
 *
 * `--reset` is narrower here than the one in `db-seed-samples.mts`, which clears
 * every quotation: it deletes only reports for this customer on this date. A
 * service report is a record of a visit that happened, and a flag that wipes the
 * table is one keystroke away from destroying reports that were not seeded. The
 * sequence is deliberately *not* restarted for the same reason — the gap a
 * deleted report leaves is intended, and restarting a shared counter would
 * collide with references already printed.
 */

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { requireDirectUrl } from "../db/connection";
import * as schema from "../db/schema";
import { recordActivity } from "../lib/activity/service";
import { describeTally, tallyChecklist } from "../lib/service-reports/format";
import type { ServiceReportInput } from "../lib/service-reports/form";
import { createServiceReport } from "../lib/service-reports/service";

const { serviceReports } = schema;

const pool = new Pool({ connectionString: requireDirectUrl() });
const db = drizzle(pool, { schema });

const CUSTOMER = "SHOPPERS SAVER GROCERY";
const SERVICE_DATE = "2026-08-07";

/** The tally the source sheet shows: eleven √, two X, nothing left blank. */
const EXPECTED = { pass: 11, service: 2, na: 0, unmarked: 0 };

/*
 * Transcribed from the PDF, and deliberately verbatim — including "Fuctionality"
 * in the first action, which is a typo on the original sheet. This row exists so
 * the generated document can be held against the source line for line; silently
 * correcting it would make that comparison lie. Fix it in the dashboard rather
 * than here if the wording should change going forward.
 */
const REPORT: ServiceReportInput = {
  kind: "checklist",
  customerName: CUSTOMER,
  address: "Brgy. Baraca Camachile Subic, Zambales",
  projectTitle:
    "Preventive Maintenance of Fire Detection and Alarm System (FDAS)",
  systemDescription: "Conventional Fire Detection and Alarm System",
  serviceDate: SERVICE_DATE,
  panelType: "conventional",

  equipment: [
    {
      model: "AW-CFP2166-4",
      brand: "ASENWARE",
      location: "ALL FLOORS",
      detectors: "SD - 16 Units",
      manualPulls: "2 UNITS",
      bellsStrobes: "2 UNITS",
    },
  ],
  otherEquipment: null,

  checklist: {
    // Alarm Panel Supervisory Function — all six passed.
    panel_ac_power_loss: "pass",
    panel_secondary_power_loss: "pass",
    open_alarm_circuits: "pass",
    short_alarm_circuits: "pass",
    panel_to_panel_circuits: "pass",
    ground_faults_detected: "pass",

    // Panel Inspection — the two paperwork questions are the ones marked X.
    in_operation_on_arrival: "pass",
    equipment_secured: "pass",
    lamps_and_displays: "pass",
    primary_power_full_load: "pass",
    drawings_available: "service",
    instructions_posted: "service",
    zones_labelled: "pass",
  },

  lines: [
    {
      action: "1. Conduct cleaning and Fuctionality Test of each Alarm Devices:",
      finding:
        "All other devices such as smoke detectors, MPS, Alarm Bells, and Main Fire Alarm Control Panel are now working normally except for the findings below.",
      severity: "note",
    },
    { action: "A. Ground Floor: (Zone 1)", finding: "", severity: "note" },
    {
      action: "Smoke Detectors - 9 Units   MPS - 1 Unit   Alarm Bell - 1 Unit",
      finding: "",
      severity: "note",
    },
    // The two rows the original writes in red, hung under the ground floor.
    { action: "", finding: "Batteries were busted.", severity: "defect" },
    {
      action: "",
      finding:
        "False Alarms in the ground floor. Need to replace smoke detectors with heat detectors",
      severity: "defect",
    },
    { action: "B. Second Floor: (Zone 2)", finding: "", severity: "note" },
    {
      action: "Smoke Detectors - 7 Units   MPS - 1 Unit   Alarm Bell - 1 Unit",
      finding: "",
      severity: "note",
    },
  ],

  recommendations: [
    "FDAS System is working properly",
    "Replace the Batteries of the Fire Alarm Control Panel",
    "Replace all smoke detectors at ground floor with heat detectors.",
  ],

  // The three sections the checklist report does not print — see the enum.
  findings: [],
  activities: [],
  plates: [],

  servicedByName: "Engr. Bryan A. Lalap",
  // The sheet prints only the fixed "REYDEX's Representative/s" caption under
  // the rule, so there is no title to record.
  servicedByTitle: null,
  // Countersigned by hand on site; the sheet leaves the second rule empty.
  notedByName: null,
};

try {
  if (process.argv.includes("--reset")) {
    const removed = await db
      .delete(serviceReports)
      .where(
        and(
          eq(serviceReports.customerName, CUSTOMER),
          eq(serviceReports.serviceDate, SERVICE_DATE),
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

  const { id, reportNo } = await createServiceReport(db, REPORT);

  // No session here, so the log records "System" — see `actorLabel`. Without it
  // the dashboard's Last change column would be blank for a row that plainly
  // came from somewhere.
  await recordActivity(db, {
    action: "create",
    entity: "service_report",
    entityId: id,
    label: `${reportNo} · ${REPORT.customerName}`,
    detail: "seeded from the source PDF",
  });

  /* ---------------- Verify against the source document ---------------- */
  const tally = tallyChecklist(REPORT.checklist);

  const mismatches = (
    Object.keys(EXPECTED) as (keyof typeof EXPECTED)[]
  ).filter((key) => tally[key] !== EXPECTED[key]);

  console.log(`\n  ${reportNo}  ${REPORT.customerName}`);
  console.log(`  ${describeTally(tally)}`);
  console.log(
    `  ${REPORT.equipment.length} panel · ${REPORT.lines.length} findings rows · ` +
      `${REPORT.recommendations.length} recommendations`,
  );
  console.log(`\n  /service-reports/${id}/print`);

  if (mismatches.length > 0) {
    console.error(
      `\n✖ Checklist does not match the source sheet: ${mismatches.join(", ")}\n`,
    );
    process.exitCode = 1;
  } else {
    console.log("\n✔ Checklist matches the original PDF\n");
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n✖ Failed: ${message}\n`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
