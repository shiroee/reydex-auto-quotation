import { describe, expect, it } from "vitest";

import {
  amountInWords,
  formatPeso,
  integerToWords,
  multiplyAmount,
  sumAmounts,
} from "./money";

describe("multiplyAmount", () => {
  it("reproduces the line totals printed in the samples", () => {
    expect(multiplyAmount("5400.00", 3)).toBe("16200.00"); // True North bells
    expect(multiplyAmount("600.00", 10)).toBe("6000.00"); // Umicore 10 lb refills
    expect(multiplyAmount("4500.00", 3)).toBe("13500.00"); // Umicore HCFC
    expect(multiplyAmount("40000.00", 1)).toBe("40000.00"); // Puregold FDAS
  });

  it("handles fractional quantities", () => {
    expect(multiplyAmount("100.00", "2.5")).toBe("250.00");
    expect(multiplyAmount("33.33", "3")).toBe("99.99");
  });

  it("rounds half-up to centavos", () => {
    // 0.125 → 0.13
    expect(multiplyAmount("0.25", "0.5")).toBe("0.13");
    expect(multiplyAmount("0.01", "0.5")).toBe("0.01");
  });

  it("returns zero for a zero quantity", () => {
    expect(multiplyAmount("1200.00", 0)).toBe("0.00");
  });

  it("keeps the sign for negative amounts", () => {
    expect(multiplyAmount("-100.00", 2)).toBe("-200.00");
  });

  it("stays exact where floats would drift", () => {
    // 1234.56 * 3 is 3703.6800000000003 in floating point.
    expect(multiplyAmount("1234.56", 3)).toBe("3703.68");
  });
});

describe("amountInWords", () => {
  it("reproduces the wording on the Puregold proposal", () => {
    // The sample document prints: "Amount in Words: NINETY THOUSAND PESOS ONLY"
    expect(amountInWords("90000.00")).toBe("NINETY THOUSAND PESOS ONLY");
  });

  it("renders the other two sample totals", () => {
    expect(amountInWords("18900.00")).toBe(
      "EIGHTEEN THOUSAND NINE HUNDRED PESOS ONLY",
    );
    expect(amountInWords("22500.00")).toBe(
      "TWENTY-TWO THOUSAND FIVE HUNDRED PESOS ONLY",
    );
  });

  it.each([
    ["0", "ZERO PESOS ONLY"],
    ["0.00", "ZERO PESOS ONLY"],
    ["1", "ONE PESO ONLY"],
    ["2", "TWO PESOS ONLY"],
    ["15", "FIFTEEN PESOS ONLY"],
    ["20", "TWENTY PESOS ONLY"],
    ["21", "TWENTY-ONE PESOS ONLY"],
    ["100", "ONE HUNDRED PESOS ONLY"],
    ["101", "ONE HUNDRED ONE PESOS ONLY"],
    ["600", "SIX HUNDRED PESOS ONLY"],
    ["1000", "ONE THOUSAND PESOS ONLY"],
    ["1200", "ONE THOUSAND TWO HUNDRED PESOS ONLY"],
    ["16200", "SIXTEEN THOUSAND TWO HUNDRED PESOS ONLY"],
    ["40000", "FORTY THOUSAND PESOS ONLY"],
    ["1000000", "ONE MILLION PESOS ONLY"],
    ["1000000000", "ONE BILLION PESOS ONLY"],
  ])("converts %s", (input, expected) => {
    expect(amountInWords(input)).toBe(expected);
  });

  it("skips empty scale groups rather than emitting stray words", () => {
    // 1,000,050 must not become "ONE MILLION ZERO THOUSAND FIFTY".
    expect(amountInWords("1000050")).toBe("ONE MILLION FIFTY PESOS ONLY");
  });

  it("joins centavos with AND and uses the singular where appropriate", () => {
    expect(amountInWords("1234.56")).toBe(
      "ONE THOUSAND TWO HUNDRED THIRTY-FOUR PESOS AND FIFTY-SIX CENTAVOS ONLY",
    );
    expect(amountInWords("1.01")).toBe("ONE PESO AND ONE CENTAVO ONLY");
    expect(amountInWords("2.02")).toBe("TWO PESOS AND TWO CENTAVOS ONLY");
  });

  it("omits the peso clause when the amount is under one peso", () => {
    expect(amountInWords("0.50")).toBe("FIFTY CENTAVOS ONLY");
    expect(amountInWords("0.01")).toBe("ONE CENTAVO ONLY");
  });

  it("rounds half-up at the third decimal and carries into pesos", () => {
    expect(amountInWords("1.005")).toBe("ONE PESO AND ONE CENTAVO ONLY");
    expect(amountInWords("1.004")).toBe("ONE PESO ONLY");
    expect(amountInWords("1.999")).toBe("TWO PESOS ONLY");
  });

  it("accepts numbers and pre-formatted strings", () => {
    expect(amountInWords(90000)).toBe("NINETY THOUSAND PESOS ONLY");
    expect(amountInWords("₱90,000.00")).toBe("NINETY THOUSAND PESOS ONLY");
    expect(amountInWords("PHP 90,000.00")).toBe("NINETY THOUSAND PESOS ONLY");
  });

  it("marks negatives instead of silently dropping the sign", () => {
    expect(amountInWords("-500")).toBe("NEGATIVE FIVE HUNDRED PESOS ONLY");
  });

  it("honours a custom or omitted suffix", () => {
    expect(amountInWords("90000", { suffix: "" })).toBe("NINETY THOUSAND PESOS");
  });

  it.each([["abc"], [""], ["1.2.3"], ["."]])("rejects %p", (input) => {
    expect(() => amountInWords(input)).toThrow(TypeError);
  });

  it("refuses amounts beyond the supported scale", () => {
    expect(() => amountInWords("1" + "0".repeat(21))).toThrow(RangeError);
  });
});

describe("integerToWords", () => {
  it("returns an empty string for zero so callers can special-case it", () => {
    expect(integerToWords(0n)).toBe("");
  });

  it("handles values beyond Number.MAX_SAFE_INTEGER exactly", () => {
    expect(integerToWords(9007199254740993n)).toContain("QUADRILLION");
  });
});

describe("formatPeso", () => {
  it("normalises the inconsistent renderings in the samples to two decimals", () => {
    expect(formatPeso("1500")).toBe("₱1,500.00");
    expect(formatPeso("600")).toBe("₱600.00");
    expect(formatPeso("1200.00")).toBe("₱1,200.00");
  });

  it("groups thousands correctly across magnitudes", () => {
    expect(formatPeso("90000")).toBe("₱90,000.00");
    expect(formatPeso("100")).toBe("₱100.00");
    expect(formatPeso("1000")).toBe("₱1,000.00");
    expect(formatPeso("1234567.89")).toBe("₱1,234,567.89");
  });

  it("supports the PHP prefix used on the proposal total row", () => {
    expect(formatPeso("90000", { symbol: "PHP", spaceAfterSymbol: true })).toBe(
      "PHP 90,000.00",
    );
    expect(formatPeso("90000", { symbol: "" })).toBe("90,000.00");
  });

  it("keeps the sign outside the symbol", () => {
    expect(formatPeso("-250.5")).toBe("-₱250.50");
  });
});

describe("sumAmounts", () => {
  it("reproduces each sample's total from its line items", () => {
    // True North: 1,200 + 1,500 + (3 × 5,400)
    expect(sumAmounts(["1200.00", "1500.00", "16200.00"])).toBe("18900.00");
    // Umicore: 6,000 + 3,000 + 13,500
    expect(sumAmounts(["6000.00", "3000.00", "13500.00"])).toBe("22500.00");
    // Puregold: 40,000 + 50,000
    expect(sumAmounts(["40000.00", "50000.00"])).toBe("90000.00");
  });

  it("adds centavos without float drift", () => {
    // 0.1 + 0.2 in floating point is 0.30000000000000004.
    expect(sumAmounts(["0.10", "0.20"])).toBe("0.30");
    expect(sumAmounts(Array.from({ length: 10 }, () => "0.10"))).toBe("1.00");
  });

  it("returns zero for an empty list", () => {
    expect(sumAmounts([])).toBe("0.00");
  });

  it("handles negatives (credits or discounts)", () => {
    expect(sumAmounts(["1000.00", "-250.50"])).toBe("749.50");
    expect(sumAmounts(["100.00", "-250.50"])).toBe("-150.50");
  });
});
