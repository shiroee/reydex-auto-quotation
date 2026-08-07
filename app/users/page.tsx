import type { Metadata } from "next";
import Link from "next/link";
import { LuPencil, LuPlus } from "react-icons/lu";

import { AppHeader } from "@/components/app-header";
import { DeleteRowButton } from "@/components/delete-row-button";
import { LastChange } from "@/components/last-change";
import { RecordCard, RecordList } from "@/components/record-list";
import {
  RowAction,
  RowActions,
  type RowActionsAlign,
} from "@/components/row-actions";
import { latestActivityFor } from "@/lib/activity/service";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth/session";
import { normalizeSearch, SEARCH_PARAM } from "@/lib/quotations/search";
import { ROLE_LABEL } from "@/lib/users/form";
import { listUsers, type UserRecord } from "@/lib/users/service";

import { deleteUserAction } from "./actions";
import { UsersSearch } from "./users-search";
import { UserStatusButton } from "./user-status-button";

export const metadata: Metadata = { title: "Users" };

export const dynamic = "force-dynamic";

/** One row, plus the two things only the caller's session can tell us. */
type Row = UserRecord & { isSelf: boolean; isLastAdmin: boolean };

/** One row's controls, drawn once in the table cell and once in the phone card. */
function Controls({ row, align }: { row: Row; align?: RowActionsAlign }) {
  /*
   * Why a control is refused, in the order the refusals matter. Both are
   * re-checked in the actions — the counts behind them can go stale between this
   * render and a click — but saying so up front beats arming a button that
   * always fails.
   */
  const lastAdmin = "The only administrator left — promote someone else first";

  return (
    <RowActions align={align}>
      <RowAction href={`/users/${row.id}/edit`} icon={LuPencil} tone="primary">
        Edit
      </RowAction>

      <UserStatusButton
        id={row.id}
        name={row.name}
        disabled={row.disabled}
        blockedReason={
          row.isSelf && !row.disabled
            ? "You cannot disable your own account"
            : row.isLastAdmin && !row.disabled
              ? lastAdmin
              : undefined
        }
        align={align}
      />

      {/*
       * Deletion is allowed even for someone who has raised quotations: a
       * quotation stores its own signatory name and title, and keeps only a soft
       * link to the account. Say what will be severed rather than blocking it —
       * and note that disabling is the reversible way.
       */}
      <DeleteRowButton
        action={deleteUserAction}
        id={row.id}
        name={row.name}
        blockedReason={
          row.isSelf
            ? "You cannot delete your own account"
            : row.isLastAdmin
              ? lastAdmin
              : undefined
        }
        warning={
          row.quotationCount > 0
            ? `Their ${row.quotationCount} ${
                row.quotationCount === 1 ? "quotation" : "quotations"
              } stay, but stop being credited to anyone. Disable instead to just block sign-in.`
            : undefined
        }
        align={align}
      />
    </RowActions>
  );
}

/** Shown beside the name of an account that can no longer sign in. */
function DisabledBadge({ reason }: { reason: string | null }) {
  return (
    <span
      title={reason ?? "Cannot sign in"}
      className="rounded-md bg-red-500/12 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-red-200/80"
    >
      Disabled
    </span>
  );
}

/** Marks the row belonging to whoever is reading the page. */
function SelfBadge() {
  return (
    <span className="rounded-md bg-gold-100/8 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-gold-100/50">
      You
    </span>
  );
}

function RoleLabel({ row }: { row: Row }) {
  if (row.role === null) {
    // An account provisioned outside this dashboard may carry no role at all.
    return <span className="text-gold-100/35">—</span>;
  }

  return (
    <span className={row.role === "admin" ? "text-gold-200" : undefined}>
      {ROLE_LABEL[row.role]}
    </span>
  );
}

export default async function UsersPage(props: PageProps<"/users">) {
  const session = await requireAdmin();

  const term = normalizeSearch((await props.searchParams)[SEARCH_PARAM]);
  const result = await listUsers(db, { search: term });

  /*
   * The accounts live in Neon Auth, so listing them can fail on its own — a
   * dashboard that renders "no users" when the auth server is unreachable would
   * be a lie, and an inviting one given what the buttons here do.
   */
  if (!result.ok) {
    return (
      <main className="reydex-auth-surface flex flex-1 flex-col">
        <AppHeader />
        <div className="flex-1 px-5 py-8 sm:px-8 sm:py-10">
          <div className="mx-auto w-full max-w-5xl">
            <div className="reydex-card rounded-2xl p-8 text-center" role="alert">
              <p className="text-gold-100/70">{result.message}</p>
              <p className="mt-2 text-sm text-gold-100/40">
                Accounts are held by Neon Auth, not by this app&apos;s database.{" "}
                <Link href="/users" className="text-gold-300 underline">
                  Try again
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const activeAdmins = result.users.filter(
    (user) => user.role === "admin" && !user.disabled,
  ).length;

  const rows: Row[] = result.users.map((user) => ({
    ...user,
    isSelf: user.id === session.user.id,
    isLastAdmin:
      user.role === "admin" && !user.disabled && activeAdmins <= 1,
  }));

  // One lookup for the rows on this page; `now` is fixed so every row is
  // measured against the same instant.
  const activity = await latestActivityFor(
    db,
    "user",
    rows.map((row) => row.id),
  );
  const now = new Date();

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader>
        <Link
          href="/users/new"
          className="reydex-submit inline-flex h-10 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold sm:h-9"
        >
          <LuPlus aria-hidden className="size-4" />
          <span className="sm:hidden">New</span>
          <span className="hidden sm:inline">New user</span>
        </Link>
      </AppHeader>

      <div className="flex-1 px-5 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto w-full max-w-5xl">
          <UsersSearch term={term} />

          {/*
           * `role="status"` on the result line and on the empty card, so a
           * search submitted from the keyboard is announced without focus
           * having to move into the results.
           */}
          {term && rows.length > 0 ? (
            <p className="mb-3 text-xs text-gold-100/45" role="status">
              {rows.length} {rows.length === 1 ? "match" : "matches"} for “
              {term}”
            </p>
          ) : null}

          {rows.length === 0 ? (
            <div
              className="reydex-card rounded-2xl p-8 text-center"
              role={term ? "status" : undefined}
            >
              {term ? (
                <>
                  <p className="text-gold-100/70">No users match “{term}”.</p>
                  <p className="mt-2 text-sm text-gold-100/40">
                    Searches cover the name and email address.{" "}
                    <Link href="/users" className="text-gold-300 underline">
                      Show all users
                    </Link>
                    .
                  </p>
                </>
              ) : (
                <>
                  <p className="text-gold-100/70">No users yet.</p>
                  <p className="mt-2 text-sm text-gold-100/40">
                    Add one with{" "}
                    <Link href="/users/new" className="text-gold-300 underline">
                      New user
                    </Link>
                    .
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Cards on a phone; the table from `md` up. */}
              <RecordList>
                {rows.map((row) => (
                  <RecordCard
                    key={row.id}
                    title={row.name}
                    href={`/users/${row.id}/edit`}
                    badge={
                      <>
                        {row.disabled ? (
                          <DisabledBadge reason={row.disabledReason} />
                        ) : null}
                        {row.isSelf ? <SelfBadge /> : null}
                      </>
                    }
                    subtitle={row.email}
                    facts={[
                      { label: "Role", value: <RoleLabel row={row} /> },
                      {
                        label: "Status",
                        value: row.disabled ? "Cannot sign in" : "Active",
                      },
                      { label: "Quotes", value: row.quotationCount },
                      {
                        label: "Change",
                        value: (
                          <LastChange
                            entry={activity.get(row.id) ?? null}
                            now={now}
                          />
                        ),
                      },
                    ]}
                    actions={<Controls row={row} />}
                  />
                ))}
              </RecordList>

              <div className="reydex-card hidden overflow-x-auto rounded-2xl md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gold-500/15 text-xs uppercase tracking-wider text-gold-100/45">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Quotes
                      </th>
                      <th className="px-4 py-3 font-medium">Last change</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-gold-500/8 last:border-0"
                      >
                        <td className="px-4 py-3 text-gold-100/85">
                          <span className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/users/${row.id}/edit`}
                              className="underline-offset-2 hover:text-gold-100 hover:underline"
                            >
                              {row.name}
                            </Link>
                            {row.isSelf ? <SelfBadge /> : null}
                          </span>
                          <span className="mt-0.5 block max-w-72 truncate text-xs text-gold-100/35">
                            {row.email}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gold-100/55">
                          <RoleLabel row={row} />
                        </td>
                        <td className="px-4 py-3 text-gold-100/55">
                          {row.disabled ? (
                            <DisabledBadge reason={row.disabledReason} />
                          ) : (
                            "Active"
                          )}
                        </td>
                        {/*
                         * What they have prepared. Not a delete blocker — see
                         * `Controls` — but it is what makes the warning there
                         * concrete.
                         */}
                        <td className="px-4 py-3 text-right tabular-nums text-gold-100/55">
                          {row.quotationCount}
                        </td>
                        <td className="px-4 py-3 text-gold-100/55">
                          <LastChange
                            entry={activity.get(row.id) ?? null}
                            now={now}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Controls row={row} align="end" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
