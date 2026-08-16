import { describe, expect, it } from "vitest";

import { describeTally, formatLongDate, tallyChecklist } from "./format";

describe("tallyChecklist", () => {
  it("counts the unanswered items against the fixed thirteen", () => {
    const tally = tallyChecklist({
      panel_ac_power_loss: "pass",
      open_alarm_circuits: "service",
      zones_labelled: "na",
    });

    expect(tally).toEqual({
      pass: 1,
      service: 1,
      na: 1,
      unmarked: 10,
      total: 13,
    });
  });

  it("counts an empty checklist as all unmarked", () => {
    expect(tallyChecklist({})).toMatchObject({ unmarked: 13, pass: 0 });
  });

  /*
   * Driven by the item list, not by the map's own keys: a key retired in a later
   * release would otherwise be counted as an answer to a question nobody asks.
   */
  it("ignores keys that are no longer questions", () => {
    expect(tallyChecklist({ retired_item: "pass" })).toMatchObject({
      pass: 0,
      unmarked: 13,
    });
  });
});

describe("describeTally", () => {
  it("names only the counts that are not zero", () => {
    expect(
      describeTally({ pass: 13, service: 0, na: 0, unmarked: 0, total: 13 }),
    ).toBe("13 pass");

    expect(
      describeTally({ pass: 11, service: 2, na: 0, unmarked: 0, total: 13 }),
    ).toBe("11 pass · 2 to service");
  });

  it("says so when nothing has been marked", () => {
    expect(
      describeTally({ pass: 0, service: 0, na: 0, unmarked: 13, total: 13 }),
    ).toBe("13 unmarked");
  });

  it("falls back rather than printing an empty cell", () => {
    expect(
      describeTally({ pass: 0, service: 0, na: 0, unmarked: 0, total: 0 }),
    ).toBe("Not started");
  });
});

describe("formatLongDate", () => {
  /*
   * Re-exported from the certificates so both documents date the same visit the
   * same way; this is the guard on that link surviving a refactor.
   */
  it("prints a calendar date without going through a timezone", () => {
    expect(formatLongDate("2026-08-07")).toBe("August 7, 2026");
  });
});
