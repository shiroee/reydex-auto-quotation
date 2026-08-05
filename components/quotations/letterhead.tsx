import type { CompanyProfile } from "@/db";
import type { BrandImage } from "@/lib/brand";

import { ReydexMark } from "../brand/reydex-mark";

/**
 * Modern letterhead: the mark and trading name on the left, a compact contact
 * block on the right, separated from the body by a gold rule with the
 * registration and distributor line beneath it.
 *
 * Replaces the original Word treatment (green display type, bold serif address
 * block, underlined blue mailto) with a single sans-serif scale, a muted grey
 * for secondary detail, and one accent colour.
 *
 * Rendered `position: fixed` by print.css so browsers repeat it on every page.
 */
export function Letterhead({
  profile,
  logo,
}: {
  profile: CompanyProfile | undefined;
  logo: BrandImage | null;
}) {
  if (!profile) return null;

  const registration = profile.tin
    ? `${profile.vatRegistered ? "VAT" : "Non-VAT"} Registered · TIN ${profile.tin}`
    : null;

  return (
    <header className="q-letterhead">
      <div className="q-lh-main">
        <div className="q-lh-identity">
          <ReydexMark logo={logo} height={78} priority />

          <div className="q-lh-name">
            <p className="q-lh-company">{profile.name}</p>
            {profile.tagline ? (
              <p className="q-lh-tagline">{stripEllipsis(profile.tagline)}</p>
            ) : null}
          </div>
        </div>

        <div className="q-lh-contact">
          {profile.mainAddress ? (
            <p>
              <span className="q-lh-key">Main</span>
              {profile.mainAddress}
            </p>
          ) : null}
          {profile.branchAddress ? (
            <p>
              <span className="q-lh-key">Branch</span>
              {profile.branchAddress}
            </p>
          ) : null}
          {profile.phones.length > 0 ? (
            <p>
              <span className="q-lh-key">Tel</span>
              {profile.phones.join("  ·  ")}
            </p>
          ) : null}
          {profile.email ? (
            <p>
              <span className="q-lh-key">Email</span>
              {profile.email}
            </p>
          ) : null}
        </div>
      </div>

      <div className="q-lh-rule" aria-hidden="true" />

      {registration || profile.footerLine ? (
        <p className="q-lh-meta">
          {registration ? <span>{registration}</span> : null}
          {registration && profile.footerLine ? (
            <span className="q-lh-sep" aria-hidden="true" />
          ) : null}
          {profile.footerLine ? <span>{profile.footerLine}</span> : null}
        </p>
      ) : null}
    </header>
  );
}

/** The stored tagline ends in an ellipsis from the old artwork; drop it. */
function stripEllipsis(value: string): string {
  return value.replace(/[….]+\s*$/, "");
}
