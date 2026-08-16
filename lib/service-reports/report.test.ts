import { describe, expect, it } from "vitest";

import {
  CHECKLIST_ITEMS,
  PANEL_INSPECTION,
  SUPERVISORY_FUNCTIONS,
  isBlankLine,
  isChecklistMark,
  normalizeChecklist,
  normalizeEquipment,
  normalizeLines,
  normalizeRecommendations,
  toLineSeverity,
  toPanelType,
} from "./report";

describe("the fixed checklists", () => {
  it("keeps the thirteen items of the original sheet", () => {
    expect(SUPERVISORY_FUNCTIONS).toHaveLength(6);
    expect(PANEL_INSPECTION).toHaveLength(7);
    expect(CHECKLIST_ITEMS).toHaveLength(13);
  });

  /*
   * The keys are what a saved report is stored against, so a duplicate would
   * have two questions sharing one answer — and a rename would read back as an
   * unmarked item. This is the guard on both.
   */
  it("gives every item a distinct key", () => {
    const keys = CHECKLIST_ITEMS.map((item) => item.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("describes every supervisory function and no inspection question", () => {
    expect(SUPERVISORY_FUNCTIONS.every((item) => item.description)).toBe(true);
    expect(PANEL_INSPECTION.some((item) => item.description)).toBe(false);
  });
});

describe("isChecklistMark", () => {
  it("accepts the three marks of the legend", () => {
    expect(isChecklistMark("pass")).toBe(true);
    expect(isChecklistMark("service")).toBe(true);
    expect(isChecklistMark("na")).toBe(true);
  });

  it("rejects anything else, so nothing unknown reaches the sheet", () => {
    expect(isChecklistMark("")).toBe(false);
    expect(isChecklistMark("√")).toBe(false);
    expect(isChecklistMark(null)).toBe(false);
    expect(isChecklistMark(1)).toBe(false);
  });
});

describe("normalizeChecklist", () => {
  it("keeps marks against live items", () => {
    const marks = normalizeChecklist({
      panel_ac_power_loss: "pass",
      zones_labelled: "service",
    });

    expect(marks).toEqual({
      panel_ac_power_loss: "pass",
      zones_labelled: "service",
    });
  });

  it("drops keys that are no longer questions, and unknown marks", () => {
    const marks = normalizeChecklist({
      retired_item: "pass",
      panel_ac_power_loss: "maybe",
      open_alarm_circuits: "na",
    });

    expect(marks).toEqual({ open_alarm_circuits: "na" });
  });

  it("reads a non-object as no marks rather than throwing", () => {
    expect(normalizeChecklist(null)).toEqual({});
    expect(normalizeChecklist([])).toEqual({});
    expect(normalizeChecklist("pass")).toEqual({});
  });

  /* An unanswered item is absent, not defaulted — see the type's own note. */
  it("never invents a mark for an item nobody answered", () => {
    expect(normalizeChecklist({})).toEqual({});
  });
});

describe("toPanelType and toLineSeverity", () => {
  it("read the values they know", () => {
    expect(toPanelType("addressable")).toBe("addressable");
    expect(toPanelType("conventional")).toBe("conventional");
    expect(toLineSeverity("defect")).toBe("defect");
    expect(toLineSeverity("note")).toBe("note");
  });

  it("fall back for anything else, so a hand-made submission claims nothing", () => {
    expect(toPanelType("mesh")).toBe("conventional");
    expect(toPanelType(undefined)).toBe("conventional");
    expect(toLineSeverity("critical")).toBe("note");
    expect(toLineSeverity(null)).toBe("note");
  });
});

describe("normalizeLines", () => {
  it("keeps a row filled on one side only", () => {
    const lines = normalizeLines([
      { action: "A. Ground Floor: (Zone 1)", finding: "", severity: "note" },
      { action: "", finding: "Batteries were busted.", severity: "defect" },
    ]);

    expect(lines).toEqual([
      { action: "A. Ground Floor: (Zone 1)", finding: "", severity: "note" },
      { action: "", finding: "Batteries were busted.", severity: "defect" },
    ]);
  });

  it("drops rows blank on both sides", () => {
    expect(
      normalizeLines([{ action: "", finding: "", severity: "defect" }]),
    ).toEqual([]);
  });

  it("repairs rows written outside the form", () => {
    expect(normalizeLines([{ action: 42 }, null])).toEqual([]);
    expect(normalizeLines([{ finding: "Panel dusty" }])).toEqual([
      { action: "", finding: "Panel dusty", severity: "note" },
    ]);
  });

  it("reads a non-array as no rows", () => {
    expect(normalizeLines(null)).toEqual([]);
    expect(normalizeLines({ action: "x" })).toEqual([]);
  });
});

describe("normalizeEquipment", () => {
  it("keeps a row with any cell filled and drops one with none", () => {
    const rows = normalizeEquipment([
      {
        model: "AW-CFP2166-4",
        brand: "ASENWARE",
        location: "ALL FLOORS",
        detectors: "SD - 16 Units",
        manualPulls: "2 UNITS",
        bellsStrobes: "2 UNITS",
      },
      { model: "", brand: "", location: "" },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].detectors).toBe("SD - 16 Units");
  });

  it("fills the cells a partial row is missing", () => {
    expect(normalizeEquipment([{ brand: "ASENWARE" }])).toEqual([
      {
        model: "",
        brand: "ASENWARE",
        location: "",
        detectors: "",
        manualPulls: "",
        bellsStrobes: "",
      },
    ]);
  });
});

describe("normalizeRecommendations", () => {
  it("trims and drops the blanks", () => {
    expect(
      normalizeRecommendations([
        "  FDAS System is working properly  ",
        "",
        "   ",
        42,
        "Replace the Batteries of the Fire Alarm Control Panel",
      ]),
    ).toEqual([
      "FDAS System is working properly",
      "Replace the Batteries of the Fire Alarm Control Panel",
    ]);
  });
});

describe("isBlankLine", () => {
  it("is true only when both sides are empty", () => {
    expect(isBlankLine({ action: "", finding: "", severity: "note" })).toBe(true);
    expect(isBlankLine({ action: "x", finding: "", severity: "note" })).toBe(
      false,
    );
    expect(isBlankLine({ action: "", finding: "y", severity: "note" })).toBe(
      false,
    );
  });
});
