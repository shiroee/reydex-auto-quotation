import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth/session";
import { isUserId } from "@/lib/users/form";
import { getUser } from "@/lib/users/service";

import { UserForm } from "../../user-form";

export const dynamic = "force-dynamic";

/** `null` for both a malformed id and a missing account, so the page 404s either way. */
async function loadUser(id: string) {
  return isUserId(id) ? getUser(db, id) : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/users/[id]/edit">): Promise<Metadata> {
  const { id } = await params;
  const user = await loadUser(id);

  return { title: user ? `Edit ${user.name}` : "User" };
}

export default async function EditUserPage({
  params,
}: PageProps<"/users/[id]/edit">) {
  const session = await requireAdmin();

  const { id } = await params;
  const user = await loadUser(id);

  if (!user) notFound();

  const isSelf = user.id === session.user.id;

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader />

      <div className="flex-1 px-5 py-8 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <h1 className="text-sm font-semibold uppercase tracking-[0.18em] text-gold-200">
            Edit user
          </h1>

          {/*
           * An account that cannot sign in is worth saying so on the form as
           * well: the fields all still save, which would otherwise read as
           * having restored their access.
           */}
          {user.disabled ? (
            <p className="text-xs text-gold-100/45">
              This account is disabled and cannot sign in. Saving changes here
              does not restore access — use Enable on the{" "}
              <span className="text-gold-300">Users</span> list for that.
            </p>
          ) : null}

          {user.quotationCount > 0 ? (
            <p className="text-xs text-gold-100/45">
              Credited with {user.quotationCount}{" "}
              {user.quotationCount === 1 ? "quotation" : "quotations"}. Renaming
              the account does not change what those documents print — each
              quotation stores its own signatory.
            </p>
          ) : null}

          <UserForm user={user} isSelf={isSelf} />
        </div>
      </div>
    </main>
  );
}
