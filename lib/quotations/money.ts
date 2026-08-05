/**
 * Money formatting and the "Amount in Words" line the proposals carry.
 *
 * Pure and dependency-free so it can be unit tested and reused by the document
 * renderer. Amounts arrive as strings because that is what Drizzle returns for
 * `numeric` columns — passing them around as strings avoids float drift on
 * values like 1234.56.
 */

const ONES = [
  "",
  "ONE",
  "TWO",
  "THREE",
  "FOUR",
  "FIVE",
  "SIX",
  "SEVEN",
  "EIGHT",
  "NINE",
  "TEN",
  "ELEVEN",
  "TWELVE",
  "THIRTEEN",
  "FOURTEEN",
  "FIFTEEN",
  "SIXTEEN",
  "SEVENTEEN",
  "EIGHTEEN",
  "NINETEEN",
] as const;

const TENS = [
  "",
  "",
  "TWENTY",
  "THIRTY",
  "FORTY",
  "FIFTY",
  "SIXTY",
  "SEVENTY",
  "EIGHTY",
  "NINETY",
] as const;

/** Short scale, which is what Philippine commercial documents use. */
const SCALES = [
  "",
  "THOUSAND",
  "MILLION",
  "BILLION",
  "TRILLION",
  "QUADRILLION",
] as const;

/** Splits a decimal string into exact whole/fraction parts, rounding to 2dp. */
function splitAmount(value: string | number): {
  negative: boolean;
  pesos: bigint;
  centavos: number;
} {
  let raw = typeof value === "number" ? value.toFixed(2) : value.trim();

  if (raw === "") {
    throw new TypeError("amount is empty");
  }

  const negative = raw.startsWith("-");
  if (negative || raw.startsWith("+")) raw = raw.slice(1);

  // Tolerate thousands separators and a currency prefix.
  raw = raw.replace(/[,\s₱]/g, "").replace(/^PHP/i, "");

  if (!/^\d*(\.\d*)?$/.test(raw) || raw === "" || raw === ".") {
    throw new TypeError(`not a valid amount: ${String(value)}`);
  }

  const [whole = "", fraction = ""] = raw.split(".");

  let pesos = BigInt(whole === "" ? "0" : whole);
  let centavos: number;

  if (fraction.length <= 2) {
    centavos = Number(fraction.padEnd(2, "0"));
  } else {
    // Round half-up on the third decimal, carrying into pesos when needed.
    const twoDp = Number(fraction.slice(0, 2));
    const shouldRoundUp = Number(fraction[2]) >= 5;
    centavos = shouldRoundUp ? twoDp + 1 : twoDp;
    if (centavos === 100) {
      centavos = 0;
      pesos += 1n;
    }
  }

  return { negative, pesos, centavos };
}

/** 0–999 to words. */
function chunkToWords(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;

  if (hundreds > 0) parts.push(`${ONES[hundreds]} HUNDRED`);

  if (rest > 0) {
    if (rest < 20) {
      parts.push(ONES[rest]);
    } else {
      const tens = Math.floor(rest / 10);
      const ones = rest % 10;
      parts.push(ones > 0 ? `${TENS[tens]}-${ONES[ones]}` : TENS[tens]);
    }
  }

  return parts.join(" ");
}

/** Non-negative integer to words. Returns "" for 0 so callers can special-case. */
export function integerToWords(value: bigint): string {
  if (value === 0n) return "";

  // Break into 3-digit groups, least significant first.
  const chunks: number[] = [];
  let remaining = value;
  while (remaining > 0n) {
    chunks.push(Number(remaining % 1000n));
    remaining /= 1000n;
  }

  if (chunks.length > SCALES.length) {
    throw new RangeError("amount is too large to express in words");
  }

  const words: string[] = [];
  for (let i = chunks.length - 1; i >= 0; i -= 1) {
    if (chunks[i] === 0) continue;
    const scale = SCALES[i];
    words.push(scale ? `${chunkToWords(chunks[i])} ${scale}` : chunkToWords(chunks[i]));
  }

  return words.join(" ");
}

export type AmountInWordsOptions = {
  /** Trailing word used on the samples. Set to "" to omit. */
  suffix?: string;
  /** Currency nouns, for reuse if a quote is ever raised in another currency. */
  majorSingular?: string;
  majorPlural?: string;
  minorSingular?: string;
  minorPlural?: string;
};

/**
 * Renders the "Amount in Words:" line.
 *
 *   amountInWords("90000.00") → "NINETY THOUSAND PESOS ONLY"
 *
 * That example is the exact wording on the Puregold proposal, which is what the
 * test suite pins against.
 */
export function amountInWords(
  value: string | number,
  options: AmountInWordsOptions = {},
): string {
  const {
    suffix = "ONLY",
    majorSingular = "PESO",
    majorPlural = "PESOS",
    minorSingular = "CENTAVO",
    minorPlural = "CENTAVOS",
  } = options;

  const { negative, pesos, centavos } = splitAmount(value);

  const parts: string[] = [];

  if (pesos > 0n) {
    parts.push(`${integerToWords(pesos)} ${pesos === 1n ? majorSingular : majorPlural}`);
  }

  if (centavos > 0) {
    const centavoWords = `${chunkToWords(centavos)} ${
      centavos === 1 ? minorSingular : minorPlural
    }`;
    parts.push(parts.length > 0 ? `AND ${centavoWords}` : centavoWords);
  }

  // Nothing at all: still produce a legible, signable line.
  if (parts.length === 0) parts.push(`ZERO ${majorPlural}`);

  const body = parts.join(" ");
  const signed = negative ? `NEGATIVE ${body}` : body;

  return suffix ? `${signed} ${suffix}` : signed;
}

export type PesoFormatOptions = {
  /** "₱" (default), "PHP", or "" for a bare number. */
  symbol?: "₱" | "PHP" | "";
  /** Space between symbol and digits. The samples do both; default is none. */
  spaceAfterSymbol?: boolean;
};

/**
 * Formats an amount the same way every time.
 *
 * The samples are inconsistent — "₱ 1,200.00", "₱ 1,500", "P 600" and
 * "PHP 90,000.00" all appear — so generated documents normalise to two decimal
 * places with grouped thousands.
 */
export function formatPeso(
  value: string | number,
  options: PesoFormatOptions = {},
): string {
  const { symbol = "₱", spaceAfterSymbol = false } = options;
  const { negative, pesos, centavos } = splitAmount(value);

  const grouped = pesos.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const digits = `${grouped}.${centavos.toString().padStart(2, "0")}`;
  const gap = symbol && spaceAfterSymbol ? " " : "";

  return `${negative ? "-" : ""}${symbol}${gap}${digits}`;
}

/**
 * Multiplies an amount by a quantity exactly, in scaled integers.
 *
 * Mirrors the `quantity * unit_price` generated column so the total previewed
 * in the builder matches the one Postgres stores. Quantities carry at most two
 * decimals, matching `numeric(12, 2)`; anything finer is rounded half-up.
 */
export function multiplyAmount(
  amount: string | number,
  quantity: string | number,
): string {
  const price = splitAmount(amount);
  const qty = splitAmount(quantity);

  const priceCentavos =
    (price.negative ? -1n : 1n) * (price.pesos * 100n + BigInt(price.centavos));
  const qtyHundredths =
    (qty.negative ? -1n : 1n) * (qty.pesos * 100n + BigInt(qty.centavos));

  // centavos × hundredths gives a value scaled by 100 too many; round half-up.
  const scaled = priceCentavos * qtyHundredths;
  const negative = scaled < 0n;
  const magnitude = negative ? -scaled : scaled;

  let centavos = magnitude / 100n;
  if (magnitude % 100n >= 50n) centavos += 1n;

  const whole = centavos / 100n;
  const fraction = centavos % 100n;

  return `${negative ? "-" : ""}${whole}.${fraction.toString().padStart(2, "0")}`;
}

/**
 * Sums decimal amount strings exactly, in centavos, returning a 2dp string.
 * Used for previewing a quotation total before Postgres computes the stored one.
 */
export function sumAmounts(values: readonly (string | number)[]): string {
  let centavoTotal = 0n;

  for (const value of values) {
    const { negative, pesos, centavos } = splitAmount(value);
    const magnitude = pesos * 100n + BigInt(centavos);
    centavoTotal += negative ? -magnitude : magnitude;
  }

  const negative = centavoTotal < 0n;
  const absolute = negative ? -centavoTotal : centavoTotal;
  const whole = absolute / 100n;
  const fraction = absolute % 100n;

  return `${negative ? "-" : ""}${whole}.${fraction.toString().padStart(2, "0")}`;
}
