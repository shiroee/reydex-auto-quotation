import { relations, sql } from "drizzle-orm";
import {
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/*
 * Type-only, and pointing at `lib/` rather than the other way round as
 * `ScopeSection` does: the checklist definitions these shapes describe have to
 * live in a database-free module to stay unit testable, so the shapes live
 * beside them. Erased at compile time, so the schema still pulls in no runtime
 * code from the app.
 */
import type {
  ServiceReportChecklist,
  ServiceReportEquipment,
  ServiceReportLine,
} from "@/lib/service-reports/report";

/*
 * Schema derived from the sample quotations (Puregold Castillejos, True North,
 * Umicore Subic).
 *
 * Two things the samples make clear and that the model leans on:
 *
 * 1. Price is a function of (product, service kind, capacity) — not of product
 *    alone. A 10 lb dry-chemical unit is PHP 1,200 brand new but PHP 600 to
 *    refill, and the 50 lb refill is PHP 3,000. So `prices` is a separate table
 *    keyed on all three, not a column on `products`.
 *
 * 2. A quotation must freeze what it quoted. Editing the catalogue later must
 *    never silently restate a quote that has already gone out, so
 *    `quotation_items` carries a full snapshot (name, description, specs,
 *    capacity, unit, price) and keeps `product_id` only as a soft backlink.
 *
 * Note: user ids reference `neon_auth.user` by value but deliberately carry no
 * foreign key — Neon Auth owns that schema and re-provisions it per branch.
 */

/** BRANDNEW … / REFILLING AND SERVICING … / PROPOSED PREVENTIVE MAINTENANCE … */
export const serviceKind = pgEnum("service_kind", [
  "new",
  "refill",
  "maintenance",
]);

export const productCategory = pgEnum("product_category", [
  "fire_extinguisher",
  "detection_alarm",
  "suppression_system",
  "accessory",
  "service",
]);

export const quotationStatus = pgEnum("quotation_status", [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
]);

/**
 * `supply` — the True North / Umicore layout: per-item spec blocks, each with
 * its own little quantity/price table.
 * `service_proposal` — the Puregold layout: one consolidated costing table
 * followed by a scope of works, exclusions and mobilisation.
 */
export const quotationTemplate = pgEnum("quotation_template", [
  "supply",
  "service_proposal",
]);

/* -------------------------------------------------------------------------- */
/* Company letterhead                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Single-sourced letterhead. The samples disagree with each other — the
 * Puregold sheet lists 0933-3347-702/0906-841-5056 while the other two list
 * 0933-3347-702/0919-6638-522/0955-0424-993 — which is exactly the drift that
 * generating documents from one record removes.
 */
export const companyProfile = pgTable("company_profile", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  tin: text("tin"),
  /** The letterhead reads "Non-VAT Reg.", so quotes carry no tax line. */
  vatRegistered: boolean("vat_registered").notNull().default(false),
  mainAddress: text("main_address"),
  branchAddress: text("branch_address"),
  phones: text("phones").array().notNull().default(sql`ARRAY[]::text[]`),
  email: text("email"),
  footerLine: text("footer_line"),
  bankAccountName: text("bank_account_name"),
  bankAccountNo: text("bank_account_no"),
  bankBranch: text("bank_branch"),
  signatoryName: text("signatory_name"),
  signatoryTitle: text("signatory_title"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: text("sku").notNull(),
    /** As printed after "ITEM n:", e.g. "DRY CHEMICAL TYPE". */
    name: text("name").notNull(),
    category: productCategory("category").notNull(),
    /** e.g. "Lion Brand"; null when the quote does not name a brand. */
    brand: text("brand"),
    /** UNIT / LOT / SET — printed in the quantity column. */
    unitLabel: text("unit_label").notNull().default("UNIT"),
    /**
     * Lead-in paragraph printed after "DESCRIPTION:". Independent of `specs`:
     * the HCFC-123 sample has both a paragraph ("2A2BCSt RATED. Stored pressure
     * type…") and a bullet list, so these are not mutually exclusive.
     */
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("products_sku_key").on(t.sku),
    index("products_category_idx").on(t.category),
  ],
);

/** Bullet lines for products whose descriptionStyle is 'bullets'. */
export const productSpecs = pgTable(
  "product_specs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
  },
  (t) => [unique("product_specs_position_key").on(t.productId, t.position)],
);

/**
 * The price list. One row per sellable variant.
 *
 * `capacityLabel` is non-null (empty string for items without a capacity, like
 * a smoke detector) so the uniqueness constraint behaves — Postgres treats
 * NULLs as distinct, which would otherwise permit duplicate variants.
 * Superseded prices are kept for history by setting `effectiveTo`.
 */
export const prices = pgTable(
  "prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    serviceKind: serviceKind("service_kind").notNull(),
    /** Display form, e.g. "10 lbs". Empty string when not applicable. */
    capacityLabel: text("capacity_label").notNull().default(""),
    /** Numeric form of the same capacity, for ordering variants. */
    capacityLbs: numeric("capacity_lbs", { precision: 8, scale: 2 }),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    effectiveFrom: date("effective_from")
      .notNull()
      .default(sql`CURRENT_DATE`),
    /** Null means this is the current price. */
    effectiveTo: date("effective_to"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // At most one live price per variant; history rows are excluded.
    uniqueIndex("prices_current_variant_key")
      .on(t.productId, t.serviceKind, t.capacityLabel)
      .where(sql`${t.effectiveTo} IS NULL`),
    index("prices_product_idx").on(t.productId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Customers                                                                  */
/* -------------------------------------------------------------------------- */

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Not unique: branches share a trading name (e.g. per-site Puregold). */
    name: text("name").notNull(),
    addressLine: text("address_line"),
    cityProvince: text("city_province"),
    /** "MR. RENE R. ESGASANE" — absent when addressed to the company. */
    contactPerson: text("contact_person"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("customers_name_idx").on(t.name)],
);

/* -------------------------------------------------------------------------- */
/* Quotations                                                                 */
/* -------------------------------------------------------------------------- */

/** Feeds the human-readable reference, which the samples lack entirely. */
export const quotationNoSeq = pgSequence("quotation_no_seq", {
  startWith: 1,
  increment: 1,
});

/** One outline node of a scope of works; nests to the depth the samples use. */
export type ScopeNode = {
  /** Printed marker, e.g. "I.", "A.", "1." */
  label?: string;
  text: string;
  children?: ScopeNode[];
};

export type ScopeSection = {
  /** e.g. "FIRE DETECTION AND ALARM SYSTEM:" */
  title: string;
  /** Lead-in paragraph before the numbered list, if any. */
  intro?: string;
  nodes: ScopeNode[];
};

export const quotations = pgTable(
  "quotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteNo: text("quote_no").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    template: quotationTemplate("template").notNull().default("supply"),
    subject: text("subject").notNull(),
    quoteDate: date("quote_date").notNull().default(sql`CURRENT_DATE`),
    validityDays: integer("validity_days").notNull().default(30),
    currency: char("currency", { length: 3 }).notNull().default("PHP"),
    status: quotationStatus("status").notNull().default("draft"),

    /* Letter body */
    attentionTo: text("attention_to"),
    salutation: text("salutation").notNull().default("Dear Sir/Ma'am,"),
    introParagraph: text("intro_paragraph"),
    closingParagraph: text("closing_paragraph"),

    /* Terms — defaulted from settings, overridable per quote */
    paymentTerms: text("payment_terms"),
    deliveryTerms: text("delivery_terms"),
    warrantyTerms: text("warranty_terms"),
    mobilization: text("mobilization"),
    /** Umicore shows bank details; True North does not. */
    showBankDetails: boolean("show_bank_details").notNull().default(false),

    scopeOfWorks: jsonb("scope_of_works").$type<ScopeSection[]>(),
    notes: text("notes"),

    /** Maintained from the line items; see recalculateQuotationTotal(). */
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),

    /** neon_auth.user.id — intentionally no FK, see the note at the top. */
    preparedByUserId: text("prepared_by_user_id"),
    signatoryName: text("signatory_name"),
    signatoryTitle: text("signatory_title"),

    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("quotations_quote_no_key").on(t.quoteNo),
    index("quotations_customer_idx").on(t.customerId),
    index("quotations_status_idx").on(t.status),
    index("quotations_date_idx").on(t.quoteDate),
  ],
);

export const quotationItems = pgTable(
  "quotation_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quotationId: uuid("quotation_id")
      .notNull()
      .references(() => quotations.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    /** Grouping header, e.g. "BRAND NEW SMOKE DETECTOR". */
    sectionTitle: text("section_title"),

    /** Soft backlink; nulled if the catalogue entry is deleted. */
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),

    /* ---- Snapshot taken when the item was added ---- */
    name: text("name").notNull(),
    serviceKind: serviceKind("service_kind").notNull(),
    description: text("description"),
    specs: jsonb("specs").$type<string[]>().notNull().default([]),
    capacityLabel: text("capacity_label").notNull().default(""),
    unitLabel: text("unit_label").notNull().default("UNIT"),

    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    /** Computed by Postgres so a line can never disagree with its inputs. */
    lineTotal: numeric("line_total", { precision: 14, scale: 2 })
      .generatedAlwaysAs(sql`quantity * unit_price`)
      .notNull(),
  },
  (t) => [
    unique("quotation_items_position_key").on(t.quotationId, t.position),
    index("quotation_items_quotation_idx").on(t.quotationId),
  ],
);

/** "Exclusions:" list on the service proposal. */
export const quotationExclusions = pgTable(
  "quotation_exclusions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quotationId: uuid("quotation_id")
      .notNull()
      .references(() => quotations.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
  },
  (t) => [
    unique("quotation_exclusions_position_key").on(t.quotationId, t.position),
  ],
);

/* -------------------------------------------------------------------------- */
/* Certificates of completion                                                 */
/* -------------------------------------------------------------------------- */

/** Feeds the RDX-COC reference; see `nextCertificateNo`. */
export const certificateNoSeq = pgSequence("certificate_no_seq", {
  startWith: 1,
  increment: 1,
});

/** Feeds the RDX-CSR reference — a separate series, see `nextCertificateNo`. */
export const certificateSafetyNoSeq = pgSequence("certificate_safety_no_seq", {
  startWith: 1,
  increment: 1,
});

/**
 * Which of the two documents a row prints as.
 *
 * They share this table because they share their particulars — client, system,
 * location, the two dates, the place of issue — and because the dashboard reads
 * as one list of "certificates we have issued". What differs is the wording and
 * the signature block, and that lives in the layouts rather than here.
 *
 * `completion` is the default so the column could be added to a table that
 * already had rows in it without guessing at what they were.
 */
export const certificateKind = pgEnum("certificate_kind", [
  "completion",
  "safety_reliability",
]);

/**
 * The closing clause of a safety & reliability certificate: the system is
 * "working normally and within its standard operating parameters", either full
 * stop or "but with minor findings to consider".
 *
 * Deliberately two values and not three. A *major* finding contradicts the
 * sentence it would be appended to — a system with one is not working normally,
 * and certifying it as such is what this document must not do. A failed
 * inspection is the absence of a certificate, not a third variant of one.
 */
export const certificateFindings = pgEnum("certificate_findings", [
  "none",
  "minor",
]);

/**
 * The one-page certificate issued once a job is finished and signed off — the
 * document a client's fire-safety file needs, and the one the Bureau of Fire
 * Protection asks for.
 *
 * Deliberately unjoined: no `customer_id`, no `quotation_id`. Certificates get
 * raised for work that was never quoted here — a subcontracted job, a site
 * inherited mid-contract — and requiring a customer record first would mean
 * inventing one to print a certificate. The cost is real and worth stating: the
 * same client will be spelled two ways across a year of certificates, and
 * nothing ties a certificate back to the quotation it completes.
 *
 * The wording is not stored. Each `kind` prints a fixed set of paragraphs from
 * its layout under `components/certificates/`, with these columns dropped into
 * the blanks, so a change of wording is one edit to the layout rather than a
 * backfill across every row.
 *
 * Several columns are read by one kind and ignored by the other —
 * `inspected_by` / `accepted_by` by the completion certificate, the three
 * `engineer_*` / `findings` columns by the safety one. The form nulls out the
 * ones the chosen kind does not print, so a row never carries a value that no
 * document will ever show.
 */
export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    certNo: text("cert_no").notNull(),
    kind: certificateKind("kind").notNull().default("completion"),

    /** Free text, as printed after "CLIENT :" — or centred under the title. */
    clientName: text("client_name").notNull(),
    /**
     * The system the document is about, as printed after "PROJECT :" and again
     * in the body: "FIRE DETECTION AND ALARM SYSTEM".
     */
    projectTitle: text("project_title").notNull(),
    /** Where the work was done: "Subic, Zambales". */
    location: text("location").notNull(),

    /** Completion of the works, or — on a safety certificate — the test date. */
    completionDate: date("completion_date").notNull(),
    issueDate: date("issue_date").notNull().default(sql`CURRENT_DATE`),
    /** Where the certificate was issued, which need not be where the work was. */
    issuePlace: text("issue_place").notNull(),

    /**
     * Who inspected the works and found them satisfactory. Often the client, but
     * not always — the sample certificate names the mall operator rather than
     * the branch. Falls back to the client name when blank.
     */
    inspectedBy: text("inspected_by"),
    /** Printed under the second signature rule; falls back to the client name. */
    acceptedBy: text("accepted_by"),

    /** Both fall back to the company profile's signatory when blank. */
    signatoryName: text("signatory_name"),
    signatoryTitle: text("signatory_title"),

    /* -- Safety & reliability only. See the note above the table. -- */

    findings: certificateFindings("findings").notNull().default("none"),
    /**
     * The signatory's PRC licence, printed under their name: the safety
     * certificate is signed in a professional capacity rather than a company
     * one, and the Bureau of Fire Protection reads the number off the sheet.
     */
    engineerLicenseNo: text("engineer_license_no"),
    /** The "Validity Date" line. Not checked against the issue date: a lapsed
     * licence is a matter for the PRC, and refusing to reprint an old
     * certificate because of one would be the wrong answer. */
    engineerLicenseExpiry: date("engineer_license_expiry"),

    /** neon_auth.user.id — intentionally no FK, see the note at the top. */
    preparedByUserId: text("prepared_by_user_id"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("certificates_cert_no_key").on(t.certNo),
    index("certificates_client_idx").on(t.clientName),
    index("certificates_issue_date_idx").on(t.issueDate),
  ],
);

/* -------------------------------------------------------------------------- */
/* FDAS service reports                                                       */
/* -------------------------------------------------------------------------- */

/** Feeds the RDX-SR reference; see `nextServiceReportNo`. */
export const serviceReportNoSeq = pgSequence("service_report_no_seq", {
  startWith: 1,
  increment: 1,
});

/** Mirrors `PANEL_TYPES` — the tick under the equipment table. */
export const panelType = pgEnum("panel_type", ["conventional", "addressable"]);

/** Mirrors `SERVICE_REPORT_KINDS`; see the note on that constant for why two. */
export const serviceReportKind = pgEnum("service_report_kind", [
  "checklist",
  "photo_report",
]);


/**
 * The maintenance report left with a client after a preventive-maintenance
 * visit to a Fire Detection and Alarm System: what was serviced, how the panel
 * scored against a fixed thirteen-item checklist, what was found, and what
 * should be done about it.
 *
 * Unjoined for the same reason `certificates` is — reports get raised for sites
 * that were never quoted here, and requiring a customer record first would mean
 * inventing one to print a report. The same cost applies: the same client will
 * be spelled two ways across a year of visits.
 *
 * Four of the columns are `jsonb` rather than child tables. They are the body of
 * a document: always read whole, always rewritten whole, never queried into and
 * never joined against. `quotation_items` is a table because a quotation's lines
 * carry money and a total that has to be recomputed from them; nothing here does
 * arithmetic, so a child table would buy four joins and a position column apiece
 * and pay for none of it. The shapes live in `lib/service-reports/report.ts`,
 * which also holds the normalisers that read them back defensively.
 */
export const serviceReports = pgTable(
  "service_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportNo: text("report_no").notNull(),
    kind: serviceReportKind("kind").notNull().default("checklist"),

    /* ---- The particulars block, which both kinds share ---- */

    /** Free text, as printed after "Customer:" — "CLIENT:" on the photo report. */
    customerName: text("customer_name").notNull(),
    address: text("address").notNull(),
    /**
     * "Preventive Maintenance of Fire Detection and Alarm System (FDAS)".
     * Printed after "Project:" on the checklist and "SUBJECT:" on the photo
     * report — the same sentence under two labels, so one column.
     */
    projectTitle: text("project_title").notNull(),
    serviceDate: date("service_date").notNull(),

    /* ---- Checklist report only ---- */

    /**
     * "Conventional Fire Detection and Alarm System" — the sentence form of what
     * `panel_type` records as a tick. The original sheet states it both ways and
     * this keeps both, because the sentence may say more than the tick can
     * ("…with addressable annunciator") and the tick is what the table needs.
     *
     * Nullable because the photo report has no System line; the form nulls it,
     * along with the four columns below, for that kind.
     */
    systemDescription: text("system_description"),
    panelType: panelType("panel_type").notNull().default("conventional"),

    equipment: jsonb("equipment")
      .$type<ServiceReportEquipment[]>()
      .notNull()
      .default([]),
    /** The free "Others" row under the equipment table; blank on most sheets. */
    otherEquipment: text("other_equipment"),
    /**
     * Marks keyed by checklist item. Partial by design — an unmarked item prints
     * blank rather than as a pass. See `ServiceReportChecklist`.
     */
    checklist: jsonb("checklist")
      .$type<ServiceReportChecklist>()
      .notNull()
      .default({}),
    lines: jsonb("lines").$type<ServiceReportLine[]>().notNull().default([]),

    /* ---- Photo report only ---- */

    /**
     * The two prose sections above the recommendations: what was found, and what
     * was done about it. The checklist report says the same things through its
     * "Action Taken / Findings" table, so these stay empty for that kind.
     */
    findings: jsonb("findings").$type<string[]>().notNull().default([]),
    activities: jsonb("activities").$type<string[]>().notNull().default([]),

    /* ---- Shared ---- */

    /** The one body section both documents print, under the same heading. */
    recommendations: jsonb("recommendations")
      .$type<string[]>()
      .notNull()
      .default([]),

    /* ---- Signatures ---- */

    /**
     * Who carried out the service — printed over the "REYDEX's Representative/s"
     * rule. Falls back to the company profile's signatory when blank, as the
     * certificates do.
     */
    servicedByName: text("serviced_by_name"),
    servicedByTitle: text("serviced_by_title"),
    /**
     * The owner's representative, if known before printing. Usually null: the
     * second block is signed by hand on site, and the sheet prints an empty rule
     * for it either way.
     */
    notedByName: text("noted_by_name"),

    /** neon_auth.user.id — intentionally no FK, see the note at the top. */
    preparedByUserId: text("prepared_by_user_id"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("service_reports_report_no_key").on(t.reportNo),
    index("service_reports_customer_idx").on(t.customerName),
    index("service_reports_service_date_idx").on(t.serviceDate),
  ],
);

/**
 * One group of photographs under a shared caption — "CLEANING AND INSPECTION OF
 * DEVICES" — as the photo report lays them out.
 *
 * A table rather than the `jsonb` the rest of the report body uses, because
 * unlike the checklist's rows these own something that cannot live in a document
 * column: the photographs themselves. Giving the caption a row of its own is
 * what stops twelve photographs each carrying their own copy of it and
 * disagreeing.
 *
 * The same caption recurs as several plates in the source document — three
 * separate "CLEANING AND INSPECTION" plates across three pages — so plates are
 * ordered and identified by `position`, never deduplicated by caption.
 */
export const serviceReportPlates = pgTable(
  "service_report_plates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => serviceReports.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    caption: text("caption").notNull(),
  },
  (t) => [
    unique("service_report_plates_position_key").on(t.reportId, t.position),
    index("service_report_plates_report_idx").on(t.reportId),
  ],
);

/**
 * A site photograph, stored as a link to a file under `public/`.
 *
 * The database keeps the path and the web server keeps the bytes. That is why
 * this table has no `bytea`: a photo report carries twenty-odd images, and rows
 * of image data would be pulled through the connection pool on every read and
 * would have to be streamed back out through an application route to be seen.
 * As a path the browser fetches each file directly, statically and cached.
 *
 * Two consequences worth knowing rather than discovering:
 *
 * 1. Deleting a report removes these rows through the cascade, but *not* the
 *    files they point at. Nothing else can — the row is the only thing that
 *    knows the path — so an orphaned file is the accepted cost of the design.
 * 2. Files under `public/` are served without authentication. These are
 *    photographs of a client's premises, and anyone holding the URL can fetch
 *    one. See the note on the upload route.
 *
 * `src` is a site-relative path under `/assets/`, never a full URL: see
 * `isSafePhotoSrc`, which is what keeps a `javascript:` or an off-site address
 * out of the column and therefore out of an `<img src>`.
 */
export const serviceReportPhotos = pgTable(
  "service_report_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    plateId: uuid("plate_id")
      .notNull()
      .references(() => serviceReportPlates.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    src: text("src").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("service_report_photos_position_key").on(t.plateId, t.position),
    index("service_report_photos_plate_idx").on(t.plateId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Reusable boilerplate                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The samples reuse three fixed combinations of letter body, terms, exclusions
 * and scope of works — brand-new supply (COD, 3-5 days), refill/servicing (per
 * contract, 5-7 days, bank details shown) and the PM proposal (50% down, scope
 * of works, exclusions). Storing them once is most of what "automate this"
 * means: pick a preset, pick items, and the document is done.
 */
export const quotationPresets = pgTable(
  "quotation_presets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    template: quotationTemplate("template").notNull(),
    /** May contain {{customer}} for interpolation. */
    subjectTemplate: text("subject_template"),
    salutation: text("salutation"),
    introParagraph: text("intro_paragraph"),
    closingParagraph: text("closing_paragraph"),
    paymentTerms: text("payment_terms"),
    deliveryTerms: text("delivery_terms"),
    warrantyTerms: text("warranty_terms"),
    mobilization: text("mobilization"),
    /** Footnote printed under the terms, e.g. "*As per contract". */
    notes: text("notes"),
    validityDays: integer("validity_days").notNull().default(30),
    showBankDetails: boolean("show_bank_details").notNull().default(false),
    exclusions: jsonb("exclusions").$type<string[]>().notNull().default([]),
    scopeOfWorks: jsonb("scope_of_works").$type<ScopeSection[]>(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("quotation_presets_slug_key").on(t.slug)],
);

/* -------------------------------------------------------------------------- */
/* Activity log                                                               */
/* -------------------------------------------------------------------------- */

export const activityAction = pgEnum("activity_action", [
  "create",
  "update",
  "delete",
]);

/** The things a dashboard lists, and therefore the things acted on. */
export const activityEntity = pgEnum("activity_entity", [
  "quotation",
  "customer",
  "item",
  "quotation_type",
  "user",
  "certificate",
  "service_report",
]);

/**
 * Who added, changed or removed each record.
 *
 * A separate log rather than `created_by`/`updated_by` columns on every table,
 * because deletion is half of the question being answered: once the row is gone
 * there is nowhere on it left to record who removed it. One append-only table
 * covers all three verbs for every entity, and it is the only place a deleted
 * record can still be accounted for.
 *
 * The actor and the record's name are stored as *snapshots*, for the same reason
 * `quotation_items` snapshots what it quoted: history has to stay readable after
 * the account that acted is deleted and after the record it names is gone.
 * Storing `actor_name` also means the log reads correctly for staff who cannot
 * call the Neon Auth admin API — resolving ids to names needs the `admin` role,
 * and everyone can see these dashboards.
 */
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    action: activityAction("action").notNull(),
    entity: activityEntity("entity").notNull(),
    /** The row acted on. No foreign key: entries outlive what they describe. */
    entityId: uuid("entity_id").notNull(),
    /** What it was called at the time, e.g. "RDX-2026-0004", "TRUE NORTH". */
    label: text("label").notNull(),
    /** Wording for what a bare verb does not convey: "disabled", "role → admin". */
    detail: text("detail"),
    /** neon_auth.user.id — intentionally no FK, see the note at the top. */
    actorUserId: text("actor_user_id"),
    actorName: text("actor_name"),
    actorEmail: text("actor_email"),
  },
  (t) => [
    index("activity_log_occurred_idx").on(t.occurredAt),
    // Serves the per-record lookup each dashboard does for its rows.
    index("activity_log_entity_idx").on(t.entity, t.entityId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Relations                                                                  */
/* -------------------------------------------------------------------------- */

export const productsRelations = relations(products, ({ many }) => ({
  specs: many(productSpecs),
  prices: many(prices),
}));

export const productSpecsRelations = relations(productSpecs, ({ one }) => ({
  product: one(products, {
    fields: [productSpecs.productId],
    references: [products.id],
  }),
}));

export const pricesRelations = relations(prices, ({ one }) => ({
  product: one(products, {
    fields: [prices.productId],
    references: [products.id],
  }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  quotations: many(quotations),
}));

export const serviceReportsRelations = relations(
  serviceReports,
  ({ many }) => ({ plates: many(serviceReportPlates) }),
);

export const serviceReportPlatesRelations = relations(
  serviceReportPlates,
  ({ one, many }) => ({
    report: one(serviceReports, {
      fields: [serviceReportPlates.reportId],
      references: [serviceReports.id],
    }),
    photos: many(serviceReportPhotos),
  }),
);

export const serviceReportPhotosRelations = relations(
  serviceReportPhotos,
  ({ one }) => ({
    plate: one(serviceReportPlates, {
      fields: [serviceReportPhotos.plateId],
      references: [serviceReportPlates.id],
    }),
  }),
);

export const quotationsRelations = relations(quotations, ({ one, many }) => ({
  customer: one(customers, {
    fields: [quotations.customerId],
    references: [customers.id],
  }),
  items: many(quotationItems),
  exclusions: many(quotationExclusions),
}));

export const quotationItemsRelations = relations(quotationItems, ({ one }) => ({
  quotation: one(quotations, {
    fields: [quotationItems.quotationId],
    references: [quotations.id],
  }),
  product: one(products, {
    fields: [quotationItems.productId],
    references: [products.id],
  }),
}));

export const quotationExclusionsRelations = relations(
  quotationExclusions,
  ({ one }) => ({
    quotation: one(quotations, {
      fields: [quotationExclusions.quotationId],
      references: [quotations.id],
    }),
  }),
);

/* -------------------------------------------------------------------------- */
/* Inferred types                                                             */
/* -------------------------------------------------------------------------- */

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Price = typeof prices.$inferSelect;
export type NewPrice = typeof prices.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type Quotation = typeof quotations.$inferSelect;
export type QuotationItem = typeof quotationItems.$inferSelect;
export type CompanyProfile = typeof companyProfile.$inferSelect;
export type Certificate = typeof certificates.$inferSelect;
export type NewCertificate = typeof certificates.$inferInsert;
export type ServiceReport = typeof serviceReports.$inferSelect;
export type NewServiceReport = typeof serviceReports.$inferInsert;
export type ServiceReportPlate = typeof serviceReportPlates.$inferSelect;
export type ServiceReportPhoto = typeof serviceReportPhotos.$inferSelect;
export type ActivityEntry = typeof activityLog.$inferSelect;
export type NewActivityEntry = typeof activityLog.$inferInsert;
