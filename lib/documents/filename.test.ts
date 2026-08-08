import { describe, expect, it } from "vitest";

import { documentFileName } from "./filename";

describe("documentFileName", () => {
  it("names a certificate the way it is filed", () => {
    expect(
      documentFileName("Reydex COC", "RDX-COC-2026-0001", "SHOPPER SAVERS"),
    ).toBe("Reydex COC RDX-COC-2026-0001 - SHOPPER SAVERS");
  });

  it("names a quotation the same way", () => {
    expect(
      documentFileName("Reydex Quotation", "RDX-2026-0004", "TRUE NORTH"),
    ).toBe("Reydex Quotation RDX-2026-0004 - TRUE NORTH");
  });

  /* The reference is what the folder gets searched by — it must survive whole. */
  it("keeps the hyphens in the reference", () => {
    expect(documentFileName("Reydex COC", "RDX-COC-2026-0001", "")).toBe(
      "Reydex COC RDX-COC-2026-0001",
    );
  });

  it("replaces characters Windows forbids in a filename", () => {
    expect(
      documentFileName("Reydex COC", "RDX-COC-2026-0002", "SHOPPER / SUBIC"),
    ).toBe("Reydex COC RDX-COC-2026-0002 - SHOPPER SUBIC");

    expect(
      documentFileName("Reydex COC", "RDX-COC-2026-0003", 'A: B?C*D"E<F>G|H'),
    ).toBe("Reydex COC RDX-COC-2026-0003 - A B C D E F G H");
  });

  it("strips control characters rather than passing them to the browser", () => {
    expect(
      documentFileName("Reydex COC", "RDX-COC-2026-0004", "SHOPPERSAVERS"),
    ).toBe("Reydex COC RDX-COC-2026-0004 - SHOPPER SAVERS");
  });

  it("collapses the whitespace a substitution leaves behind", () => {
    expect(
      documentFileName("Reydex COC", "RDX-COC-2026-0005", "SHOPPER  //  SUBIC"),
    ).toBe("Reydex COC RDX-COC-2026-0005 - SHOPPER SUBIC");
  });

  /* Windows drops these silently, leaving a file named other than as offered. */
  it("drops trailing dots and spaces", () => {
    expect(
      documentFileName("Reydex COC", "RDX-COC-2026-0006", "SHOPPER SAVERS, INC."),
    ).toBe("Reydex COC RDX-COC-2026-0006 - SHOPPER SAVERS, INC");
  });

  it("omits the separator when there is no party to name", () => {
    expect(documentFileName("Reydex Quotation", "RDX-2026-0009", "   ")).toBe(
      "Reydex Quotation RDX-2026-0009",
    );
  });
});
