import type { Metadata } from "next";

import { AppHeader } from "@/components/app-header";
import { requireSession } from "@/lib/auth/session";

import { CustomerForm } from "../customer-form";

export const metadata: Metadata = { title: "New customer" };

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  await requireSession();

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader />

      <div className="flex-1 px-5 py-8 sm:px-8">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="mb-6 text-sm font-semibold uppercase tracking-[0.18em] text-gold-200">
            New customer
          </h1>
          <CustomerForm />
        </div>
      </div>
    </main>
  );
}
