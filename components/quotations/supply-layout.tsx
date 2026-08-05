import type { BrandImage } from "@/lib/brand";
import { formatPeso } from "@/lib/quotations/money";
import type { PrintableQuotation } from "@/lib/quotations/service";

import { SignatureBlock } from "./signature-block";

type Items = PrintableQuotation["items"];

/** Named to avoid clashing with Next's global `LayoutProps` helper. */
export type QuotationLayoutProps = PrintableQuotation & {
  signature: BrandImage | null;
};

/**
 * The True North / Umicore layout: a subject block, then one spec panel per
 * item ("ITEM n:" + DESCRIPTION + its own quantity/price table), then a grand
 * total and the terms.
 *
 * Consecutive lines for the same product are grouped into a single ITEM block
 * with one table row each, which is how the Umicore sample presents the 10 lb
 * and 50 lb dry-chemical refills — one heading, two rows — rather than as two
 * separately numbered items.
 */
export function SupplyLayout({
  quotation,
  customer,
  profile,
  items,
  signature,
}: QuotationLayoutProps) {
  const groups = groupByProduct(items);
  const isRefill = items.some((item) => item.serviceKind === "refill");
  // The samples head brand-new tables TOTAL PRICE and refill tables AMOUNT.
  const amountHeading = isRefill ? "AMOUNT" : "TOTAL PRICE";

  return (
    <>
      <div className="q-addressee">
        <p className="q-strong">{customer?.name}</p>
        {customer?.cityProvince ? <p>{customer.cityProvince}</p> : null}
        <p className="q-date">{formatLongDate(quotation.quoteDate)}</p>
      </div>

      <table className="q-meta">
        <tbody>
          {quotation.attentionTo ? (
            <tr>
              <th>Attention</th>
              <td>:</td>
              <td className="q-strong">{quotation.attentionTo}</td>
            </tr>
          ) : null}
          <tr>
            <th>Subject</th>
            <td>:</td>
            <td className="q-strong">{quotation.subject}</td>
          </tr>
          <tr>
            <th>Ref. No.</th>
            <td>:</td>
            <td>{quotation.quoteNo}</td>
          </tr>
        </tbody>
      </table>

      <p className="q-salutation">{quotation.salutation}</p>
      {quotation.introParagraph ? (
        <p className="q-intro">{quotation.introParagraph}</p>
      ) : null}

      {groups.map((group, index) => {
        const [first] = group;
        // Capacity column is per-block: the smoke detector table in the sample
        // has no capacity column at all, while the extinguisher table does.
        const showCapacity = group.some((item) => item.capacityLabel !== "");

        return (
          <section className="q-item" key={first.id}>
            {first.sectionTitle ? (
              <h2 className="q-section-title">{first.sectionTitle}</h2>
            ) : null}

            <h3 className="q-item-title">
              ITEM {index + 1}: {first.name}
            </h3>

            {first.description ? (
              <p className="q-item-description">
                <span className="q-strong">DESCRIPTION:</span>{" "}
                {first.description}
              </p>
            ) : null}

            {first.specs.length > 0 ? (
              <>
                {!first.description ? (
                  <p className="q-item-description q-strong">DESCRIPTION:</p>
                ) : null}
                <ul className="q-specs">
                  {first.specs.map((spec) => (
                    <li key={spec}>{spec}</li>
                  ))}
                </ul>
              </>
            ) : null}

            <table className="q-price-table">
              <thead>
                <tr>
                  <th>QUANTITY</th>
                  {showCapacity ? <th>CAPACITY</th> : null}
                  <th>UNIT PRICE</th>
                  <th>{amountHeading}</th>
                </tr>
              </thead>
              <tbody>
                {group.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {formatQuantity(item.quantity)}{" "}
                      {Number(item.quantity) === 1
                        ? item.unitLabel
                        : pluralUnit(item.unitLabel)}
                    </td>
                    {showCapacity ? (
                      <td>{item.capacityLabel || "—"}</td>
                    ) : null}
                    <td>{formatPeso(item.unitPrice)}</td>
                    <td>{formatPeso(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      <p className="q-grand-total">
        Total Amount: {formatPeso(quotation.totalAmount)}
      </p>

      <section className="q-terms">
        <h2 className="q-terms-title">TERMS &amp; CONDITIONS:</h2>
        <table className="q-terms-table">
          <tbody>
            {quotation.deliveryTerms ? (
              <tr>
                <th>A. DELIVERY</th>
                <td>:</td>
                <td>{quotation.deliveryTerms}</td>
              </tr>
            ) : null}
            {quotation.paymentTerms ? (
              <tr>
                <th>B. PAYMENTS</th>
                <td>:</td>
                <td>{quotation.paymentTerms}</td>
              </tr>
            ) : null}
            {quotation.warrantyTerms ? (
              <tr>
                <th>C. WARRANTY</th>
                <td>:</td>
                <td>{quotation.warrantyTerms}</td>
              </tr>
            ) : null}
            <tr>
              <th>D. VALIDITY</th>
              <td>:</td>
              <td>{quotation.validityDays} days from the date above.</td>
            </tr>
          </tbody>
        </table>

        {quotation.notes ? <p className="q-note">{quotation.notes}</p> : null}

        {quotation.showBankDetails && profile?.bankAccountNo ? (
          <div className="q-bank">
            <p>Account Name: {profile.bankAccountName}</p>
            <p>Bank Account No.: {profile.bankAccountNo}</p>
            <p>Branch: {profile.bankBranch}</p>
          </div>
        ) : null}
      </section>

      {quotation.closingParagraph ? (
        <p className="q-closing">{quotation.closingParagraph}</p>
      ) : null}

      <SignatureBlock quotation={quotation} signature={signature} />
    </>
  );
}

/**
 * Collapses runs of lines that share a product into one block.
 *
 * Only *consecutive* lines group, so an intentional repeat later in the quote
 * still gets its own ITEM number. Falls back to the snapshotted name when
 * `productId` is null (the catalogue entry was deleted).
 */
function groupByProduct(items: Items): Items[] {
  const groups: Items[] = [];

  for (const item of items) {
    const previous = groups.at(-1);
    const key = item.productId ?? `name:${item.name}`;
    const previousKey = previous
      ? (previous[0].productId ?? `name:${previous[0].name}`)
      : null;

    if (previous && key === previousKey) {
      previous.push(item);
    } else {
      groups.push([item]);
    }
  }

  return groups;
}

function formatLongDate(iso: string): string {
  // Fixed locale and time zone so the printed date does not vary by host.
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Drops the ".00" that `numeric` returns for whole quantities. */
function formatQuantity(value: string): string {
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : value;
}

function pluralUnit(unitLabel: string): string {
  if (unitLabel === "UNIT") return "UNITS";
  if (unitLabel === "unit") return "units";
  return unitLabel;
}
