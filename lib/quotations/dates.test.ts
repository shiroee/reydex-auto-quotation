import { describe, expect, it } from "vitest";

import { isRealDate, parseQuoteDate, todayInQuoteZone } from "./dates";

describe("todayInQuoteZone", () => {
  it("returns the Manila date, not the UTC one", () => {
    /*
     * 23:30 UTC on the 7th is 07:30 on the 8th in Manila. This is the case the
     * function exists for: `toISOString().slice(0, 10)` answers "2026-08-07" and
     * would date a quotation raised at breakfast as yesterday.
     */
    const nightBefore = new Date("2026-08-07T23:30:00Z");

    expect(todayInQuoteZone(nightBefore)).toBe("2026-08-08");
    expect(nightBefore.toISOString().slice(0, 10)).toBe("2026-08-07");
  });

  it("agrees with UTC during Philippine working hours", () => {
    // 02:00 UTC is 10:00 in Manila — same calendar day either way.
    expect(todayInQuoteZone(new Date("2026-08-07T02:00:00Z"))).toBe("2026-08-07");
  });

  it("rolls the month and the year at the right moment", () => {
    // 15:59 UTC on 31 Dec is 23:59 the same day in Manila; 16:00 is New Year.
    expect(todayInQuoteZone(new Date("2026-12-31T15:59:00Z"))).toBe("2026-12-31");
    expect(todayInQuoteZone(new Date("2026-12-31T16:00:00Z"))).toBe("2027-01-01");
  });

  it("zero-pads, so the result is always sortable and Postgres-ready", () => {
    expect(todayInQuoteZone(new Date("2026-01-05T03:00:00Z"))).toBe("2026-01-05");
  });
});

describe("isRealDate", () => {
  it("accepts a real date", () => {
    expect(isRealDate("2026-08-07")).toBe(true);
    expect(isRealDate("2024-02-29")).toBe(true);
  });

  it("rejects a date that looks right but does not exist", () => {
    // The shape check alone passes these; Postgres would throw on the insert.
    expect(isRealDate("2026-02-30")).toBe(false);
    expect(isRealDate("2026-13-01")).toBe(false);
    expect(isRealDate("2025-02-29")).toBe(false);
  });

  it("rejects anything not in YYYY-MM-DD form", () => {
    for (const value of ["", "07/08/2026", "2026-8-7", "2026-08-07T00:00:00Z"]) {
      expect(isRealDate(value), value).toBe(false);
    }
  });
});

describe("parseQuoteDate", () => {
  it("accepts and trims a valid date", () => {
    expect(parseQuoteDate("  2026-08-07  ")).toEqual({
      ok: true,
      date: "2026-08-07",
    });
  });

  it("asks for a date when the field is blank or absent", () => {
    for (const value of ["", "   ", null, undefined, 42]) {
      const parsed = parseQuoteDate(value);

      expect(parsed.ok, String(value)).toBe(false);
      if (parsed.ok) return;

      expect(parsed.error).toBe("Choose a date.");
    }
  });

  it("rejects an impossible date with a readable message", () => {
    const parsed = parseQuoteDate("2026-02-30");

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.error).toContain("real date");
  });

  it("rejects a year that is a typo rather than a date", () => {
    for (const value of ["0206-08-07", "9026-08-07"]) {
      const parsed = parseQuoteDate(value);

      expect(parsed.ok, value).toBe(false);
      if (parsed.ok) return;

      expect(parsed.error, value).toContain("year");
    }
  });
});
