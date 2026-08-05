import Image from "next/image";

import type { Quotation } from "@/db";
import type { BrandImage } from "@/lib/brand";

/** Printed width of the signature scan. */
const SIGNATURE_WIDTH_MM = 34;

/**
 * Closing signature. When a scan is available it sits on the rule, overlapping
 * it slightly, as a wet signature would. `break-inside: avoid` in print.css
 * keeps the whole block on one page.
 */
export function SignatureBlock({
  quotation,
  signature,
  thanks = false,
}: {
  quotation: Quotation;
  signature: BrandImage | null;
  thanks?: boolean;
}) {
  // Derive the drawn height from the scan's own aspect ratio so it is never
  // squashed, and convert to px at 96dpi for next/image.
  const widthPx = Math.round((SIGNATURE_WIDTH_MM / 25.4) * 96);
  const heightPx = signature
    ? Math.round(widthPx * (signature.height / signature.width))
    : 0;

  return (
    <div className="q-signature">
      {thanks ? <p className="q-sig-thanks">Thank you very much.</p> : null}
      <p>Very Truly Yours,</p>

      <div className="q-sig-mark">
        {signature ? (
          <Image
            src={signature.src}
            alt=""
            width={widthPx}
            height={heightPx}
            // Decorative: the signatory's name is printed directly beneath.
            aria-hidden="true"
            className="q-sig-image"
          />
        ) : null}
      </div>

      <div className="q-sig-name">
        <p className="q-strong">{quotation.signatoryName}</p>
        <p className="q-sig-title">{quotation.signatoryTitle}</p>
      </div>
    </div>
  );
}
