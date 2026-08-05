import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ReydexMark } from "@/components/brand/reydex-mark";
import { safeRedirectPath } from "@/lib/auth/credentials";
import { getSession } from "@/lib/auth/session";
import { brandLogo, COMPANY_NAME, type BrandLogo } from "@/lib/brand";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: `Sign in to the ${COMPANY_NAME} quotation system.`,
};

// Reads the session cookie, so it can never be prerendered.
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [session, { next }] = await Promise.all([getSession(), searchParams]);
  const redirectTo = safeRedirectPath(next);

  if (session?.user) {
    redirect(redirectTo);
  }

  const year = new Date().getFullYear();

  return (
    <main className="reydex-auth-surface relative flex flex-1 flex-col lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ---------------- Brand panel (large screens) ---------------- */}
      <section className="relative hidden overflow-hidden border-r border-gold-500/10 lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div
          aria-hidden="true"
          className="reydex-ember pointer-events-none absolute -left-40 top-[18%] size-[36rem] rounded-full"
        />

        <BrandLockup logo={brandLogo} height={104} />

        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-500/70">
            Quotation System
          </p>
          <h2 className="mt-4 text-balance text-4xl font-semibold leading-[1.15] tracking-tight text-gold-100">
            Fire safety quotations,{" "}
            <span className="bg-gradient-to-b from-gold-200 to-gold-600 bg-clip-text text-transparent">
              built in minutes.
            </span>
          </h2>
          <p className="mt-5 text-[0.975rem] leading-relaxed text-gold-100/55">
            Sign in to prepare, price, and issue customer quotations for
            extinguishers, refills, and inspection services.
          </p>
        </div>

        <p className="relative text-xs text-gold-100/30">
          © {year} {COMPANY_NAME}
        </p>
      </section>

      {/* ---------------- Form panel ---------------- */}
      <section className="relative flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-[26rem]">
          {/* Brand lockup for small screens, where the panel above is hidden. */}
          <div className="mb-8 flex justify-center lg:hidden">
            <BrandLockup logo={brandLogo} height={88} align="center" />
          </div>

          <div className="reydex-card rounded-2xl p-6 backdrop-blur-xl sm:p-8">
            <h1 className="text-[1.7rem] font-semibold tracking-tight text-gold-100">
              Sign in
            </h1>
            <p className="mt-1.5 mb-7 text-sm text-gold-100/50">
              Use the credentials issued to you by Reydex.
            </p>

            <LoginForm redirectTo={redirectTo} />
          </div>

          <p className="mt-8 text-center text-xs text-gold-100/25 lg:hidden">
            © {year} {COMPANY_NAME}
          </p>
        </div>
      </section>
    </main>
  );
}

/**
 * The corporate lockup already contains the REYDEX wordmark, so the typographic
 * name is only drawn when we are falling back to the vector stand-in — printing
 * both would say "REYDEX" twice.
 */
function BrandLockup({
  logo,
  height,
  align = "start",
}: {
  logo: BrandLogo | null;
  height: number;
  align?: "start" | "center";
}) {
  return (
    <div
      className={`relative flex flex-col ${
        align === "center" ? "items-center text-center" : "items-start"
      }`}
    >
      <ReydexMark
        logo={logo}
        height={height}
        priority
        className="drop-shadow-[0_8px_28px_rgba(240,179,35,0.22)]"
      />

      {!logo ? (
        <span className="mt-3 bg-gradient-to-b from-gold-100 via-gold-300 to-gold-600 bg-clip-text text-2xl font-extrabold tracking-[0.13em] text-transparent">
          REYDEX
        </span>
      ) : null}

      <span className="mt-3 text-[0.65rem] font-medium uppercase tracking-[0.28em] text-gold-100/45">
        Fire Extinguisher Trading
      </span>
    </div>
  );
}
