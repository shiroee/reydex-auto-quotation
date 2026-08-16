import type { Certificate, CompanyProfile } from "@/db";
import { engineerSignatureImage, signatureImage } from "@/lib/brand";

import { CertificateLayout } from "./certificate-layout";
import { SafetyCertificateLayout } from "./safety-certificate-layout";

/**
 * Picks the template a certificate prints under, and the signature that goes
 * with it.
 *
 * The two decisions are made together on purpose. A certificate of completion
 * is signed by the company on its own behalf, so it carries the company
 * signature; a safety & reliability certification is signed by an engineer in a
 * professional capacity, so it carries theirs. Deciding the layout in one place
 * and the signature in another is how a document ends up over the wrong name.
 */
export function CertificateSheet({
  certificate,
  profile,
}: {
  certificate: Certificate;
  profile: CompanyProfile | undefined;
}) {
  if (certificate.kind === "safety_reliability") {
    return (
      <SafetyCertificateLayout
        certificate={certificate}
        profile={profile}
        signature={engineerSignatureImage}
      />
    );
  }

  return (
    <CertificateLayout
      certificate={certificate}
      profile={profile}
      signature={signatureImage}
    />
  );
}
