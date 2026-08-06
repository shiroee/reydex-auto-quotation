import { describe, expect, it } from "vitest";

import { normalizeSearch, toContainsPattern } from "./search";

describe("normalizeSearch", () => {
  it("returns the term as typed", () => {
    expect(normalizeSearch("RDX-2026-0001")).toBe("RDX-2026-0001");
    expect(normalizeSearch("Puregold")).toBe("Puregold");
  });

  it("treats a missing, blank or whitespace-only value as no filter", () => {
    expect(normalizeSearch(undefined)).toBe("");
    expect(normalizeSearch(null)).toBe("");
    expect(normalizeSearch("")).toBe("");
    expect(normalizeSearch("   ")).toBe("");
    expect(normalizeSearch("\t\n")).toBe("");
  });

  it("trims and collapses internal whitespace", () => {
    expect(normalizeSearch("  true north  ")).toBe("true north");
    expect(normalizeSearch("fire\t\n  extinguisher")).toBe("fire extinguisher");
  });

  it("takes the first value when the key repeats", () => {
    expect(normalizeSearch(["Umicore", "Puregold"])).toBe("Umicore");
    expect(normalizeSearch([])).toBe("");
  });

  it("caps the length so a pathological query cannot reach the database", () => {
    expect(normalizeSearch("a".repeat(500))).toHaveLength(120);
  });
});

describe("toContainsPattern", () => {
  it("matches anywhere in the value", () => {
    expect(toContainsPattern("Puregold")).toBe("%Puregold%");
  });

  it("escapes LIKE wildcards so they match literally", () => {
    // Without escaping, "100%" would match every row.
    expect(toContainsPattern("100%")).toBe("%100\\%%");
    expect(toContainsPattern("RDX_2026")).toBe("%RDX\\_2026%");
  });

  it("escapes backslashes so a trailing one cannot break the pattern", () => {
    expect(toContainsPattern("a\\")).toBe("%a\\\\%");
    expect(toContainsPattern("\\%")).toBe("%\\\\\\%%");
  });

  it("leaves an empty term as a match-everything pattern", () => {
    expect(toContainsPattern("")).toBe("%%");
  });
});
