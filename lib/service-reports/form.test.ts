import { describe, expect, it } from "vitest";

import {
  FIELD,
  checklistFieldName,
  isServiceReportId,
  parseServiceReportForm,
} from "./form";

/** Builds a submission; the five required fields are filled unless overridden. */
function build(fields: Record<string, string> = {}): FormData {
  const form = new FormData();

  const base: Record<string, string> = {
    [FIELD.customerName]: "SHOPPERS SAVER GROCERY",
    [FIELD.address]: "Brgy. Baraca Camachile Subic, Zambales",
    [FIELD.projectTitle]:
      "Preventive Maintenance of Fire Detection and Alarm System (FDAS)",
    [FIELD.systemDescription]: "Conventional Fire Detection and Alarm System",
    [FIELD.serviceDate]: "2026-08-07",
    ...fields,
  };

  for (const [key, value] of Object.entries(base)) {
    form.set(key, value);
  }

  return form;
}

/** Appends one row of a repeating section, in document order. */
function appendAll(form: FormData, values: Record<string, string>): void {
  for (const [key, value] of Object.entries(values)) {
    form.append(key, value);
  }
}

describe("isServiceReportId", () => {
  it("accepts a uuid in either case", () => {
    expect(isServiceReportId("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isServiceReportId("AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE")).toBe(true);
  });

  it("rejects anything else, so it never reaches Postgres as a uuid", () => {
    expect(isServiceReportId("")).toBe(false);
    expect(isServiceReportId("not-a-uuid")).toBe(false);
    expect(isServiceReportId(null)).toBe(false);
    expect(isServiceReportId(42)).toBe(false);
  });
});

describe("parseServiceReportForm", () => {
  it("accepts the five required fields and leaves the rest empty", () => {
    const parsed = parseServiceReportForm(build());

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input).toEqual({
      kind: "checklist",
      customerName: "SHOPPERS SAVER GROCERY",
      address: "Brgy. Baraca Camachile Subic, Zambales",
      projectTitle:
        "Preventive Maintenance of Fire Detection and Alarm System (FDAS)",
      systemDescription: "Conventional Fire Detection and Alarm System",
      serviceDate: "2026-08-07",
      panelType: "conventional",
      equipment: [],
      otherEquipment: null,
      checklist: {},
      lines: [],
      findings: [],
      activities: [],
      plates: [],
      recommendations: [],
      servicedByName: null,
      servicedByTitle: null,
      notedByName: null,
    });
  });

  it("names each missing required field", () => {
    const form = new FormData();
    const parsed = parseServiceReportForm(form);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(Object.keys(parsed.errors).sort()).toEqual([
      "address",
      "customerName",
      "projectTitle",
      "serviceDate",
      "systemDescription",
    ]);
  });

  it("rejects a date that is not a real day", () => {
    const parsed = parseServiceReportForm(
      build({ [FIELD.serviceDate]: "2026-02-30" }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.serviceDate).toBeDefined();
  });

  it("echoes what was typed back so a rejected submit is not wiped", () => {
    const parsed = parseServiceReportForm(
      build({ [FIELD.customerName]: "", [FIELD.address]: "  Subic  " }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.values.address).toBe("Subic");
    expect(parsed.values.serviceDate).toBe("2026-08-07");
  });

  it("reads the equipment table from its parallel columns", () => {
    const form = build();

    appendAll(form, {
      [FIELD.equipmentModel]: "AW-CFP2166-4",
      [FIELD.equipmentBrand]: "ASENWARE",
      [FIELD.equipmentLocation]: "ALL FLOORS",
      [FIELD.equipmentDetectors]: "SD - 16 Units",
      [FIELD.equipmentManualPulls]: "2 UNITS",
      [FIELD.equipmentBellsStrobes]: "2 UNITS",
    });
    // The editor keeps a spare row at the bottom; it must not be stored.
    appendAll(form, {
      [FIELD.equipmentModel]: "",
      [FIELD.equipmentBrand]: "",
      [FIELD.equipmentLocation]: "",
      [FIELD.equipmentDetectors]: "",
      [FIELD.equipmentManualPulls]: "",
      [FIELD.equipmentBellsStrobes]: "",
    });

    const parsed = parseServiceReportForm(form);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.equipment).toEqual([
      {
        model: "AW-CFP2166-4",
        brand: "ASENWARE",
        location: "ALL FLOORS",
        detectors: "SD - 16 Units",
        manualPulls: "2 UNITS",
        bellsStrobes: "2 UNITS",
      },
    ]);
  });

  /*
   * The sheet writes counts with their units — losing the "SD -" would lose
   * which kind of detector was counted.
   */
  it("keeps the counts as written rather than as numbers", () => {
    const form = build();
    appendAll(form, { [FIELD.equipmentDetectors]: "SD - 16 Units" });

    const parsed = parseServiceReportForm(form);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.equipment[0].detectors).toBe("SD - 16 Units");
  });

  it("keeps findings rows filled on one side only, and drops empty ones", () => {
    const form = build();

    appendAll(form, {
      [FIELD.lineAction]: "A. Ground Floor: (Zone 1)",
      [FIELD.lineFinding]: "",
      [FIELD.lineSeverity]: "note",
    });
    appendAll(form, {
      [FIELD.lineAction]: "",
      [FIELD.lineFinding]: "Batteries were busted.",
      [FIELD.lineSeverity]: "defect",
    });
    appendAll(form, {
      [FIELD.lineAction]: "",
      [FIELD.lineFinding]: "",
      [FIELD.lineSeverity]: "note",
    });

    const parsed = parseServiceReportForm(form);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.lines).toEqual([
      { action: "A. Ground Floor: (Zone 1)", finding: "", severity: "note" },
      { action: "", finding: "Batteries were busted.", severity: "defect" },
    ]);
  });

  it("reads only the thirteen checklist fields, and skips the unanswered", () => {
    const form = build();

    form.set(checklistFieldName("panel_ac_power_loss"), "pass");
    form.set(checklistFieldName("drawings_available"), "service");
    form.set(checklistFieldName("zones_labelled"), "not-a-mark");
    form.set(checklistFieldName("smuggled_item"), "pass");

    const parsed = parseServiceReportForm(form);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.checklist).toEqual({
      panel_ac_power_loss: "pass",
      drawings_available: "service",
    });
  });

  it("trims and drops blank recommendations", () => {
    const form = build();

    form.append(FIELD.recommendation, "  FDAS System is working properly ");
    form.append(FIELD.recommendation, "   ");
    form.append(FIELD.recommendation, "Replace the Batteries");

    const parsed = parseServiceReportForm(form);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.recommendations).toEqual([
      "FDAS System is working properly",
      "Replace the Batteries",
    ]);
  });

  it("reads an unrecognised panel type as conventional", () => {
    const parsed = parseServiceReportForm(
      build({ [FIELD.panelType]: "wireless" }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.panelType).toBe("conventional");
  });

  it("refuses a submission past the row ceilings rather than truncating it", () => {
    const form = build();

    for (let index = 0; index < 61; index += 1) {
      appendAll(form, {
        [FIELD.lineAction]: `row ${index}`,
        [FIELD.lineFinding]: "",
        [FIELD.lineSeverity]: "note",
      });
    }

    const parsed = parseServiceReportForm(form);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.lines).toBeDefined();
  });

  it("collapses blank optional text to null", () => {
    const parsed = parseServiceReportForm(
      build({
        [FIELD.servicedByName]: "Engr. Bryan A. Lalap",
        [FIELD.servicedByTitle]: "  ",
        [FIELD.notedByName]: "",
        [FIELD.otherEquipment]: "",
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.servicedByName).toBe("Engr. Bryan A. Lalap");
    expect(parsed.input.servicedByTitle).toBeNull();
    expect(parsed.input.notedByName).toBeNull();
    expect(parsed.input.otherEquipment).toBeNull();
  });
});

/**
 * Appends one plate, the way the editor submits it: a caption and the photo
 * paths as JSON. `unknown[]` so the validation tests can post values that a
 * hand-made submission could contain but the editor never would.
 */
function plate(form: FormData, caption: string, photos: unknown[]): void {
  form.append(FIELD.plateCaption, caption);
  form.append(FIELD.platePhotos, JSON.stringify(photos));
}

describe("parseServiceReportForm — photo report", () => {
  function photoForm(fields: Record<string, string> = {}): FormData {
    return build({ [FIELD.kind]: "photo_report", ...fields });
  }

  it("does not require the System line, which that sheet has no room for", () => {
    const form = photoForm();
    form.delete(FIELD.systemDescription);

    const parsed = parseServiceReportForm(form);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.systemDescription).toBeNull();
  });

  it("still requires the four particulars both sheets share", () => {
    const form = new FormData();
    form.set(FIELD.kind, "photo_report");

    const parsed = parseServiceReportForm(form);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(Object.keys(parsed.errors).sort()).toEqual([
      "address",
      "customerName",
      "projectTitle",
      "serviceDate",
    ]);
  });

  it("reads the findings and activities as bullet lists", () => {
    const form = photoForm();

    form.append(FIELD.finding, "Batteries were already drained and defective");
    form.append(FIELD.finding, "   ");
    form.append(FIELD.finding, "Fire Alarm on the System");
    form.append(FIELD.activity, "Check and test the voltage reading");

    const parsed = parseServiceReportForm(form);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.findings).toEqual([
      "Batteries were already drained and defective",
      "Fire Alarm on the System",
    ]);
    expect(parsed.input.activities).toEqual([
      "Check and test the voltage reading",
    ]);
  });

  it("reads each plate's photos, in order", () => {
    const form = photoForm();

    plate(form, "CONVENTIONAL FIRE ALARM CONTROL PANEL", ["/assets/panel.jpg"]);
    plate(form, "CLEANING AND INSPECTION OF DEVICES", [
      "/assets/clean-a.jpg",
      "/assets/clean-b.jpg",
    ]);

    const parsed = parseServiceReportForm(form);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.plates).toEqual([
      {
        caption: "CONVENTIONAL FIRE ALARM CONTROL PANEL",
        photos: ["/assets/panel.jpg"],
      },
      {
        caption: "CLEANING AND INSPECTION OF DEVICES",
        photos: ["/assets/clean-a.jpg", "/assets/clean-b.jpg"],
      },
    ]);
  });

  /*
   * These paths end up in an `<img src>`. This is the test that keeps a scheme,
   * a foreign host or a traversal out of that attribute.
   */
  it("drops any path that is not a site-relative asset", () => {
    const form = photoForm();

    plate(form, "PLATE", [
      "/assets/good.jpg",
      "javascript:alert(1)",
      "data:image/svg+xml,<svg onload=alert(1)>",
      "//evil.example/x.jpg",
      "https://evil.example/x.jpg",
      "/assets/../../etc/passwd",
      "/uploads/elsewhere.jpg",
      42,
    ]);

    const parsed = parseServiceReportForm(form);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.plates[0].photos).toEqual(["/assets/good.jpg"]);
  });

  it("refuses a plate list that is not JSON", () => {
    const form = photoForm();

    form.append(FIELD.plateCaption, "PLATE");
    form.append(FIELD.platePhotos, "/assets/a.jpg,/assets/b.jpg");

    const parsed = parseServiceReportForm(form);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.plates).toBeDefined();
  });

  it("drops a plate that would print a caption over nothing", () => {
    const form = photoForm();
    plate(form, "EMPTY PLATE", []);

    const parsed = parseServiceReportForm(form);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.plates).toEqual([]);
  });

  it("refuses more photos than a plate may hold", () => {
    const form = photoForm();
    plate(
      form,
      "PLATE",
      Array.from({ length: 13 }, (_, index) => `/assets/p${index}.jpg`),
    );

    const parsed = parseServiceReportForm(form);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.plates).toBeDefined();
  });

  /* Switching kind must not carry the other document's body across. */
  it("empties the checklist body, and a checklist empties the plates", () => {
    const photo = photoForm();
    photo.set(checklistFieldName("panel_ac_power_loss"), "pass");
    photo.append(FIELD.lineAction, "A. Ground Floor");
    photo.append(FIELD.equipmentModel, "AW-CFP2166-4");

    const asPhoto = parseServiceReportForm(photo);
    expect(asPhoto.ok).toBe(true);
    if (!asPhoto.ok) return;

    expect(asPhoto.input.checklist).toEqual({});
    expect(asPhoto.input.lines).toEqual([]);
    expect(asPhoto.input.equipment).toEqual([]);

    const list = build();
    plate(list, "PLATE", ["/assets/a.jpg"]);
    list.append(FIELD.finding, "Batteries drained");

    const asChecklist = parseServiceReportForm(list);
    expect(asChecklist.ok).toBe(true);
    if (!asChecklist.ok) return;

    expect(asChecklist.input.plates).toEqual([]);
    expect(asChecklist.input.findings).toEqual([]);
  });

  it("reads an unrecognised kind as the checklist", () => {
    const parsed = parseServiceReportForm(build({ [FIELD.kind]: "video" }));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.kind).toBe("checklist");
  });
});

