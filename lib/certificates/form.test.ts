import { describe, expect, it } from "vitest";

import {
  FIELD,
  isCertificateId,
  parseCertificateForm,
  toCertificateKind,
} from "./form";

/** Builds a submission; the six required fields are filled unless overridden. */
function build(fields: Record<string, string> = {}): FormData {
  const form = new FormData();

  const base: Record<string, string> = {
    [FIELD.clientName]: "SHOPPER SAVERS",
    [FIELD.projectTitle]: "FIRE DETECTION AND ALARM SYSTEM",
    [FIELD.location]: "Subic, Zambales",
    [FIELD.completionDate]: "2026-08-07",
    [FIELD.issueDate]: "2026-08-06",
    [FIELD.issuePlace]: "Subic, Zambales",
    ...fields,
  };

  for (const [key, value] of Object.entries(base)) {
    form.set(key, value);
  }

  return form;
}

describe("isCertificateId", () => {
  it("accepts a uuid in either case", () => {
    expect(isCertificateId("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isCertificateId("AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE")).toBe(true);
  });

  it("rejects anything else, so it never reaches Postgres as a uuid", () => {
    expect(isCertificateId("")).toBe(false);
    expect(isCertificateId("not-a-uuid")).toBe(false);
    expect(isCertificateId(null)).toBe(false);
    expect(isCertificateId(42)).toBe(false);
  });
});

describe("parseCertificateForm", () => {
  it("accepts the six required fields and nulls the rest", () => {
    const parsed = parseCertificateForm(build());

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input).toEqual({
      kind: "completion",
      clientName: "SHOPPER SAVERS",
      projectTitle: "FIRE DETECTION AND ALARM SYSTEM",
      location: "Subic, Zambales",
      completionDate: "2026-08-07",
      issueDate: "2026-08-06",
      issuePlace: "Subic, Zambales",
      inspectedBy: null,
      acceptedBy: null,
      signatoryName: null,
      signatoryTitle: null,
      findings: "none",
      engineerLicenseNo: null,
      engineerLicenseExpiry: null,
    });
  });

  it("keeps the optional parties when given", () => {
    const parsed = parseCertificateForm(
      build({
        [FIELD.inspectedBy]: "Puregold Olongapo",
        [FIELD.acceptedBy]: "SHOPPER SAVERS",
        [FIELD.signatoryName]: "REYNALDO MANALO",
        [FIELD.signatoryTitle]: "General Manager",
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.inspectedBy).toBe("Puregold Olongapo");
    expect(parsed.input.acceptedBy).toBe("SHOPPER SAVERS");
    expect(parsed.input.signatoryName).toBe("REYNALDO MANALO");
    expect(parsed.input.signatoryTitle).toBe("General Manager");
  });

  it("trims what was typed", () => {
    const parsed = parseCertificateForm(
      build({ [FIELD.clientName]: "  SHOPPER SAVERS  " }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.clientName).toBe("SHOPPER SAVERS");
  });

  it.each([
    [FIELD.clientName, "clientName"],
    [FIELD.projectTitle, "projectTitle"],
    [FIELD.location, "location"],
    [FIELD.issuePlace, "issuePlace"],
  ])("rejects a blank %s — the printed sentence needs it", (field, key) => {
    const parsed = parseCertificateForm(build({ [field]: "   " }));

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors[key as keyof typeof parsed.errors]).toBeDefined();
  });

  it("rejects a date that is not a real day", () => {
    const parsed = parseCertificateForm(
      build({ [FIELD.completionDate]: "2026-02-30" }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.completionDate).toBeDefined();
  });

  it("rejects a missing date rather than defaulting one", () => {
    const parsed = parseCertificateForm(build({ [FIELD.issueDate]: "" }));

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.issueDate).toBeDefined();
  });

  /*
   * The sample certificate is dated the 6th and certifies work completed on the
   * 7th. Whether that is a typo or a deliberate back-dating is the issuer's
   * business — refusing it would refuse to reproduce their own file.
   */
  it("allows an issue date before the completion date", () => {
    const parsed = parseCertificateForm(
      build({
        [FIELD.completionDate]: "2026-08-07",
        [FIELD.issueDate]: "2026-08-06",
      }),
    );

    expect(parsed.ok).toBe(true);
  });

  it("rejects an over-long field", () => {
    const parsed = parseCertificateForm(
      build({ [FIELD.clientName]: "X".repeat(201) }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.clientName).toBeDefined();
  });

  it("echoes what was typed so a rejected form is not wiped", () => {
    const parsed = parseCertificateForm(
      build({ [FIELD.clientName]: "", [FIELD.location]: "Subic, Zambales" }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.values.location).toBe("Subic, Zambales");
    expect(parsed.values.projectTitle).toBe("FIRE DETECTION AND ALARM SYSTEM");
  });

  it("reports no error keys at all when the form is good", () => {
    const parsed = parseCertificateForm(build());

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    // `checkRequired` returns undefined for "fine"; those keys must be stripped
    // or `Object.keys(errors).length` would count them and reject every form.
    expect(parsed.values.clientName).toBe("SHOPPER SAVERS");
  });
});

describe("toCertificateKind", () => {
  it("passes both kinds through", () => {
    expect(toCertificateKind("completion")).toBe("completion");
    expect(toCertificateKind("safety_reliability")).toBe("safety_reliability");
  });

  /*
   * The field is a radio group with a default, so an unrecognised value means a
   * hand-made submission — and the safe reading of one is the document that
   * carries no professional licence.
   */
  it("falls back to the completion certificate for anything else", () => {
    expect(toCertificateKind("safety")).toBe("completion");
    expect(toCertificateKind(null)).toBe("completion");
    expect(toCertificateKind(undefined)).toBe("completion");
  });
});

describe("parseCertificateForm — safety & reliability", () => {
  /** The sample certification, as its form would arrive. */
  function safety(fields: Record<string, string> = {}): FormData {
    return build({
      [FIELD.kind]: "safety_reliability",
      [FIELD.clientName]: "SHOPPERS SAVER GROCERY",
      [FIELD.projectTitle]: "Fire Detection and Alarm System",
      [FIELD.location]: "Brgy. Baraca Camachile Subic, Zambales",
      [FIELD.completionDate]: "2026-08-07",
      [FIELD.issueDate]: "2026-08-12",
      [FIELD.issuePlace]: "Brgy. Baraca Camachile Subic, Zambales",
      ...fields,
    });
  }

  it("keeps the engineer's registration and the findings clause", () => {
    const parsed = parseCertificateForm(
      safety({
        [FIELD.signatoryName]: "BRYAN A. LALAP",
        [FIELD.signatoryTitle]: "Registered Mechanical Engineer (RME)",
        [FIELD.engineerLicenseNo]: "90214",
        [FIELD.engineerLicenseExpiry]: "2027-09-14",
        [FIELD.findings]: "minor",
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.kind).toBe("safety_reliability");
    expect(parsed.input.signatoryName).toBe("BRYAN A. LALAP");
    expect(parsed.input.engineerLicenseNo).toBe("90214");
    expect(parsed.input.engineerLicenseExpiry).toBe("2027-09-14");
    expect(parsed.input.findings).toBe("minor");
  });

  it("defaults the findings clause to none", () => {
    const parsed = parseCertificateForm(safety());

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.findings).toBe("none");
  });

  it("takes a blank licence expiry as null rather than an error", () => {
    const parsed = parseCertificateForm(
      safety({ [FIELD.engineerLicenseExpiry]: "" }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.engineerLicenseExpiry).toBeNull();
  });

  it("still rejects a typed licence expiry that is not a real day", () => {
    const parsed = parseCertificateForm(
      safety({ [FIELD.engineerLicenseExpiry]: "2027-02-30" }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.engineerLicenseExpiry).toBeDefined();
  });

  /*
   * Nobody countersigns a safety certification, so the two parties are dropped
   * rather than stored — a row must not carry a value no document will print.
   */
  it("drops the inspecting and accepting parties", () => {
    const parsed = parseCertificateForm(
      safety({
        [FIELD.inspectedBy]: "Puregold Olongapo",
        [FIELD.acceptedBy]: "SHOPPERS SAVER GROCERY",
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.inspectedBy).toBeNull();
    expect(parsed.input.acceptedBy).toBeNull();
  });

  /** The mirror image: a completion certificate carries no licence. */
  it("drops the engineer's registration from a completion certificate", () => {
    const parsed = parseCertificateForm(
      build({
        [FIELD.engineerLicenseNo]: "90214",
        [FIELD.engineerLicenseExpiry]: "2027-09-14",
        [FIELD.findings]: "minor",
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.engineerLicenseNo).toBeNull();
    expect(parsed.input.engineerLicenseExpiry).toBeNull();
    expect(parsed.input.findings).toBe("none");
  });

  it("rejects an over-long PRC registration number", () => {
    const parsed = parseCertificateForm(
      safety({ [FIELD.engineerLicenseNo]: "9".repeat(41) }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.engineerLicenseNo).toBeDefined();
  });

  it("echoes the kind so a rejected form does not revert to the other one", () => {
    const parsed = parseCertificateForm(safety({ [FIELD.clientName]: "" }));

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.values.kind).toBe("safety_reliability");
  });
});
