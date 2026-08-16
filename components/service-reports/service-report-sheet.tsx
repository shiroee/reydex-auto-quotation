import type { CompanyProfile } from "@/db";
import type { BrandImage } from "@/lib/brand";
import type { ServiceReportRecord } from "@/lib/service-reports/service";

import { PhotoReportLayout } from "./photo-report-layout";
import { ServiceReportLayout } from "./service-report-layout";

/**
 * Picks the template a service report prints under.
 *
 * The counterpart of `CertificateSheet`, and deliberately thinner than it: both
 * documents are signed by whoever carried out the visit, so unlike the two
 * certificates there is no second decision about whose signature goes on the
 * sheet — only the photo report does not print one at all, because the original
 * carries no signature block.
 */
export function ServiceReportSheet({
  report,
  profile,
  signature,
}: {
  report: ServiceReportRecord;
  profile: CompanyProfile | undefined;
  signature: BrandImage | null;
}) {
  if (report.kind === "photo_report") {
    return <PhotoReportLayout report={report} />;
  }

  return (
    <ServiceReportLayout
      report={report}
      profile={profile}
      signature={signature}
    />
  );
}
