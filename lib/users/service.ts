import { count, eq, isNotNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import { quotations } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { normalizeSearch } from "@/lib/quotations/search";

import { describeAdminUserError, type Role, type UserInput } from "./form";

/**
 * Staff accounts.
 *
 * Unlike the other dashboards, the records here are not ours. Accounts live in
 * Neon Auth, and this module drives them through the Better Auth *admin* plugin
 * (`auth.admin.*`) rather than through SQL:
 *
 *  - `neon_auth` is Neon's schema, re-provisioned per branch and deliberately
 *    outside `db/schema.ts` (see the note at the top of it). Reading it with
 *    Drizzle would couple us to a layout we do not own, and declaring a table
 *    for it would hand `drizzle-kit generate` a schema it must not manage.
 *  - Passwords must be hashed, and disabling an account has to revoke its live
 *    sessions. Both belong to the auth server, not to an UPDATE statement.
 *
 * Every call carries the caller's session cookie, so the auth server re-checks
 * that they hold the `admin` role. Our own `requireAdmin()` gate is therefore
 * the courtesy, and this is the enforcement.
 *
 * The one thing we do read from our own tables is how many quotations an account
 * has prepared, which is genuinely ours: `quotations.prepared_by_user_id`.
 */
export type UserDb = NodePgDatabase<typeof schema>;

/** A staff account as the dashboard shows it. */
export type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: Role | null;
  /** True once the account has been disabled; it can then no longer sign in. */
  disabled: boolean;
  disabledReason: string | null;
  createdAt: Date | null;
  /** Quotations they prepared. Attribution only — see `deleteUser`. */
  quotationCount: number;
};

/** What every write here reports back. */
export type UserMutationResult =
  | { ok: true }
  | { ok: false; field?: "name" | "email" | "password" | "role"; message: string };

/** As above, plus the id of the account just created, for the activity log. */
export type CreateUserResult =
  | { ok: true; id: string }
  | { ok: false; field?: "name" | "email" | "password" | "role"; message: string };

/**
 * Set on the Neon Auth record so the reason an account cannot sign in is legible
 * from the database as well as from this dashboard.
 */
const DISABLED_REASON = "Disabled by an administrator";

/**
 * Upper bound on one page of accounts.
 *
 * Reydex issues accounts to its own staff, so the whole list arrives in one call
 * and the search below filters it in memory. That is what lets one box match a
 * name *or* an email address — `admin/list-users` searches a single field per
 * call. If this ever grows past a couple of hundred people, move the search and
 * paging upstream (`searchField`/`searchValue`, `limit`/`offset`).
 */
const MAX_USERS = 200;

/** Narrows whatever the admin plugin reports into the roles we issue. */
function toRole(value: unknown): Role | null {
  return value === "admin" || value === "user" ? value : null;
}

/**
 * How many quotations each account has prepared, keyed by user id.
 *
 * One grouped query rather than a correlated subquery per row: the ids live in
 * a different system, so there is nothing to join against here. It also steps
 * around the qualification trap documented in `lib/customers/service.ts` —
 * `prepared_by_user_id` is `text` while the account id is a `uuid`, and the cast
 * that comparison needs is exactly the kind of interpolated fragment Drizzle
 * renders unqualified inside a select list.
 */
async function quotationCounts(db: UserDb): Promise<Map<string, number>> {
  const rows = await db
    .select({ userId: quotations.preparedByUserId, total: count() })
    .from(quotations)
    .where(isNotNull(quotations.preparedByUserId))
    .groupBy(quotations.preparedByUserId);

  return new Map(
    rows.flatMap((row) => (row.userId ? [[row.userId, row.total]] : [])),
  );
}

export type ListUsersOptions = {
  /**
   * Free text matched case-insensitively against the name and email address.
   * Blank or omitted lists everyone.
   */
  search?: string;
};

export type ListUsersResult =
  | { ok: true; users: UserRecord[] }
  | { ok: false; message: string };

/** Alphabetical by name, for the index page. */
export async function listUsers(
  db: UserDb,
  { search }: ListUsersOptions = {},
): Promise<ListUsersResult> {
  const { data, error } = await auth.admin.listUsers({
    query: { limit: MAX_USERS },
  });

  if (error || !data) {
    console.error("[users] list failed", error);
    return { ok: false, message: describeAdminUserError(error).message };
  }

  const counts = await quotationCounts(db);

  const users: UserRecord[] = data.users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: toRole(user.role),
    // `banned` is nullable upstream — an account that was never banned has no row value.
    disabled: user.banned === true,
    disabledReason: user.banReason ?? null,
    createdAt: user.createdAt ?? null,
    quotationCount: counts.get(user.id) ?? 0,
  }));

  const term = normalizeSearch(search).toLowerCase();

  const matched = term
    ? users.filter(
        (user) =>
          user.name.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term),
      )
    : users;

  return {
    ok: true,
    users: matched.sort((a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    ),
  };
}

/**
 * One account, for the edit page.
 *
 * Fetched by filtering the list: the admin plugin exposes no "get one" endpoint,
 * and the list is a single call for a staff-sized directory anyway.
 */
export async function getUser(
  db: UserDb,
  id: string,
): Promise<UserRecord | null> {
  const result = await listUsers(db);

  if (!result.ok) return null;

  return result.users.find((user) => user.id === id) ?? null;
}

/**
 * How many accounts can still administer the system.
 *
 * Guards the last way in. Disabling, deleting or demoting the only enabled
 * administrator would leave nobody able to manage accounts, and the way back
 * from that is a database write (`npm run grant-admin`) rather than anything in
 * the app — so the actions refuse instead.
 */
export async function countActiveAdmins(db: UserDb): Promise<number | null> {
  const result = await listUsers(db);

  if (!result.ok) return null;

  return result.users.filter((user) => user.role === "admin" && !user.disabled)
    .length;
}

export async function createUser(input: UserInput): Promise<CreateUserResult> {
  const { data, error } = await auth.admin.createUser({
    email: input.email,
    name: input.name,
    // Required by the endpoint; the form guarantees it on this path.
    password: input.password ?? "",
    role: input.role,
  });

  if (error || !data) {
    console.error("[users] create failed", error?.code, error?.status);
    return { ok: false, ...describeAdminUserError(error) };
  }

  return { ok: true, id: data.user.id };
}

/**
 * Applies an edit: profile, role and — when one was typed — a new password.
 *
 * Three endpoints rather than one, because the admin plugin splits them. They
 * are not transactional: if the role change fails after the name was saved, the
 * name stays changed. Reporting the first failure and leaving the rest alone is
 * the honest outcome, and re-submitting the form is safe.
 */
export async function updateUser(
  id: string,
  input: UserInput,
  { currentRole }: { currentRole: Role | null },
): Promise<UserMutationResult> {
  const updated = await auth.admin.updateUser({
    userId: id,
    data: { name: input.name, email: input.email },
  });

  if (updated.error) {
    console.error("[users] update failed", updated.error.code);
    return { ok: false, ...describeAdminUserError(updated.error) };
  }

  if (input.role !== currentRole) {
    const role = await auth.admin.setRole({ userId: id, role: input.role });

    if (role.error) {
      console.error("[users] set role failed", role.error.code);
      return { ok: false, ...describeAdminUserError(role.error) };
    }
  }

  if (input.password !== null) {
    const password = await auth.admin.setUserPassword({
      userId: id,
      newPassword: input.password,
    });

    if (password.error) {
      console.error("[users] set password failed", password.error.code);
      return { ok: false, ...describeAdminUserError(password.error) };
    }
  }

  return { ok: true };
}

/**
 * Blocks sign-in without discarding the account.
 *
 * This is Better Auth's `ban`, which also revokes the account's live sessions —
 * so someone already signed in is turned out rather than left running until
 * their cookie expires. `lib/auth/credentials.ts` maps the resulting
 * `BANNED_USER` code to "This account has been disabled".
 */
export async function disableUser(id: string): Promise<UserMutationResult> {
  const { error } = await auth.admin.banUser({
    userId: id,
    banReason: DISABLED_REASON,
  });

  if (error) {
    console.error("[users] disable failed", error.code);
    return { ok: false, ...describeAdminUserError(error) };
  }

  return { ok: true };
}

export async function enableUser(id: string): Promise<UserMutationResult> {
  const { error } = await auth.admin.unbanUser({ userId: id });

  if (error) {
    console.error("[users] enable failed", error.code);
    return { ok: false, ...describeAdminUserError(error) };
  }

  return { ok: true };
}

/**
 * Removes the account for good.
 *
 * Safe for documents that have already gone out: a quotation stores the
 * signatory's name and title on the row itself, and keeps only a soft
 * `prepared_by_user_id` with no foreign key. Deleting an account therefore
 * loses the *link* between a quotation and who raised it, and nothing that
 * prints. Disabling is the reversible alternative, which the list offers.
 */
export async function deleteUser(id: string): Promise<UserMutationResult> {
  const { error } = await auth.admin.removeUser({ userId: id });

  if (error) {
    console.error("[users] delete failed", error.code);
    return { ok: false, ...describeAdminUserError(error) };
  }

  return { ok: true };
}

/** Quotations prepared by one account, for the edit page's warning. */
export async function quotationCountFor(
  db: UserDb,
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(quotations)
    .where(eq(quotations.preparedByUserId, userId));

  return row?.total ?? 0;
}
