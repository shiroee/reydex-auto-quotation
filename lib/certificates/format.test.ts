import { describe, expect, it } from "vitest";

import {
  certificateFilePrefix,
  certificateKindLabel,
  completionDateLabel,
  formatLongDate,
  formatLongDateUpper,
  formatMonthYear,
  issuedOn,
  ordinalSuffix,
} from "./format";

describe("formatLongDate", () => {
  it("prints the date the way the certificate reads it", () => {
    expect(formatLongDate("2026-08-07")).toBe("August 7, 2026");
    expect(formatLongDate("2026-01-01")).toBe("January 1, 2026");
    expect(formatLongDate("2026-12-31")).toBe("December 31, 2026");
  });

  it("drops the leading zero from the day, as the sample does", () => {
    expect(formatLongDate("2026-08-06")).toBe("August 6, 2026");
  });

  /*
   * The reason the module takes dates apart as strings. Were this parsed with
   * `new Date("2026-08-07")` — midnight UTC — a server west of Greenwich would
   * render the 6th, and the certificate would certify work on the wrong day.
   */
  it("does not shift the day with the host timezone", () => {
    const original = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";

    try {
      expect(formatLongDate("2026-08-07")).toBe("August 7, 2026");
    } finally {
      process.env.TZ = original;
    }
  });

  it("returns the input untouched when it is not a date", () => {
    expect(formatLongDate("")).toBe("");
    expect(formatLongDate("not a date")).toBe("not a date");
    expect(formatLongDate("2026-13-01")).toBe("2026-13-01");
    expect(formatLongDate("2026-08-00")).toBe("2026-08-00");
  });
});

describe("formatLongDateUpper", () => {
  it("sets the completion date in caps, as the body does", () => {
    expect(formatLongDateUpper("2026-08-07")).toBe("AUGUST 7, 2026");
  });
});

describe("formatMonthYear", () => {
  it("omits the day, which the issue line prints separately", () => {
    expect(formatMonthYear("2026-08-06")).toBe("August 2026");
  });
});

describe("ordinalSuffix", () => {
  it("uses st / nd / rd for 1, 2 and 3", () => {
    expect(ordinalSuffix(1)).toBe("st");
    expect(ordinalSuffix(2)).toBe("nd");
    expect(ordinalSuffix(3)).toBe("rd");
    expect(ordinalSuffix(21)).toBe("st");
    expect(ordinalSuffix(22)).toBe("nd");
    expect(ordinalSuffix(23)).toBe("rd");
    expect(ordinalSuffix(31)).toBe("st");
  });

  /* The case a last-digit lookup gets wrong. */
  it("uses th for the teens", () => {
    expect(ordinalSuffix(11)).toBe("th");
    expect(ordinalSuffix(12)).toBe("th");
    expect(ordinalSuffix(13)).toBe("th");
  });

  it("uses th for everything else", () => {
    expect(ordinalSuffix(4)).toBe("th");
    expect(ordinalSuffix(10)).toBe("th");
    expect(ordinalSuffix(30)).toBe("th");
  });
});

describe("issuedOn", () => {
  it("splits the issue line into its printable pieces", () => {
    expect(issuedOn("2026-08-06")).toEqual({
      day: 6,
      suffix: "th",
      monthYear: "August 2026",
    });
  });

  it("is null for an unusable date, so the sentence can be dropped", () => {
    expect(issuedOn("")).toBeNull();
    expect(issuedOn("2026-02-3")).toBeNull();
  });
});

describe("labels for the two kinds", () => {
  it("names each document short enough for a table cell", () => {
    expect(certificateKindLabel("completion")).toBe("Completion");
    expect(certificateKindLabel("safety_reliability")).toBe(
      "Safety & reliability",
    );
  });

  /* One column, two meanings: works completed, or a system tested. */
  it("reads the shared date column the way each document does", () => {
    expect(completionDateLabel("completion")).toBe("Completed");
    expect(completionDateLabel("safety_reliability")).toBe("Tested");
  });

  /*
   * Both documents get issued for the same job, so they land in the same folder
   * under the same client name — the prefix is what tells them apart there.
   */
  it("gives each kind its own filename prefix", () => {
    expect(certificateFilePrefix("completion")).toBe("Reydex COC");
    expect(certificateFilePrefix("safety_reliability")).toBe("Reydex CSR");
  });
});
