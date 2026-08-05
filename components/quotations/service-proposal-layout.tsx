import type { ScopeNode } from "@/db";
import { amountInWords, formatPeso } from "@/lib/quotations/money";

import { SignatureBlock } from "./signature-block";
import type { QuotationLayoutProps } from "./supply-layout";

/**
 * The Puregold layout: a SUBJECT heading, one consolidated costing table with
 * ITEM/DESCRIPTION/QTY/UNIT/UNIT SELL/TOTAL SELL, the amount in words, then the
 * scope of works, terms, mobilisation, exclusions and validity.
 */
export function ServiceProposalLayout({
  quotation,
  customer,
  items,
  exclusions,
  signature,
}: QuotationLayoutProps) {
  return (
    <>
      <h1 className="q-subject">
        SUBJECT: {quotation.subject.toUpperCase()}
      </h1>

      <p className="q-date-block">{formatLongDate(quotation.quoteDate)}</p>

      <div className="q-attention">
        <p>
          Attention: <span className="q-strong">{customer?.name}</span>
        </p>
        {customer?.cityProvince ? (
          <p className="q-attention-address">{customer.cityProvince}</p>
        ) : null}
        {quotation.attentionTo ? <p>{quotation.attentionTo}</p> : null}
      </div>

      <p className="q-ref">Ref. No.: {quotation.quoteNo}</p>
      <p className="q-salutation">{quotation.salutation}</p>

      {quotation.introParagraph ? (
        <p className="q-intro q-indent">{quotation.introParagraph}</p>
      ) : null}

      <table className="q-costing">
        <thead>
          <tr>
            <th>ITEM</th>
            <th>DESCRIPTION</th>
            <th>QTY</th>
            <th>UNIT</th>
            <th>UNIT SELL</th>
            <th>TOTAL SELL</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id}>
              <td className="q-center">{index + 1}</td>
              <td className="q-strong">{item.name}</td>
              <td className="q-center">{formatQuantity(item.quantity)}</td>
              <td className="q-center">{item.unitLabel}</td>
              <td className="q-right">{formatPeso(item.unitPrice, { symbol: "" })}</td>
              <td className="q-right">{formatPeso(item.lineTotal, { symbol: "" })}</td>
            </tr>
          ))}
          <tr className="q-total-row">
            <td colSpan={4}>TOTAL COST</td>
            <td colSpan={2} className="q-right">
              {formatPeso(quotation.totalAmount, {
                symbol: "PHP",
                spaceAfterSymbol: true,
              })}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="q-in-words">
        Amount in Words: {amountInWords(quotation.totalAmount)}
      </p>

      {quotation.scopeOfWorks?.length ? (
        <section className="q-scope">
          <h2 className="q-scope-heading">SCOPE OF WORKS:</h2>
          {quotation.scopeOfWorks.map((section) => (
            <div className="q-scope-section" key={section.title}>
              <h3 className="q-scope-title">{section.title}</h3>
              {section.intro ? (
                <p className="q-scope-intro">{section.intro}</p>
              ) : null}
              <ScopeNodes nodes={section.nodes} depth={0} />
            </div>
          ))}
        </section>
      ) : null}

      <section className="q-terms">
        {quotation.paymentTerms ? (
          <div className="q-term">
            <h3>Terms of Payment:</h3>
            <p>{quotation.paymentTerms}</p>
          </div>
        ) : null}

        {quotation.mobilization ? (
          <div className="q-term">
            <h3>Mobilization:</h3>
            <p>{quotation.mobilization}</p>
          </div>
        ) : null}

        {exclusions.length > 0 ? (
          <div className="q-term">
            <h3>Exclusions:</h3>
            <ol className="q-exclusions">
              {exclusions.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ol>
          </div>
        ) : null}

        <div className="q-term">
          <h3>Validity Period:</h3>
          <p>{spellDays(quotation.validityDays)} days.</p>
        </div>
      </section>

      {quotation.closingParagraph ? (
        <p className="q-closing q-indent">{quotation.closingParagraph}</p>
      ) : null}

      <SignatureBlock quotation={quotation} signature={signature} thanks />
    </>
  );
}

/** Renders the nested outline, preserving each node's printed marker. */
function ScopeNodes({ nodes, depth }: { nodes: ScopeNode[]; depth: number }) {
  return (
    <ul className={`q-scope-list q-scope-depth-${depth}`}>
      {nodes.map((node) => (
        <li key={`${node.label ?? ""}${node.text}`}>
          <span className="q-scope-item">
            {node.label ? (
              <span className="q-scope-label">{node.label}</span>
            ) : null}
            <span>{node.text}</span>
          </span>
          {node.children?.length ? (
            <ScopeNodes nodes={node.children} depth={depth + 1} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function formatLongDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatQuantity(value: string): string {
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : value;
}

/** "Thirty (30)" — matches the wording used on the sample proposal. */
function spellDays(days: number): string {
  const words: Record<number, string> = {
    7: "Seven",
    14: "Fourteen",
    15: "Fifteen",
    30: "Thirty",
    45: "Forty-Five",
    60: "Sixty",
    90: "Ninety",
  };

  return words[days] ? `${words[days]} (${days})` : String(days);
}
