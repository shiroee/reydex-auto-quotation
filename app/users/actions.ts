"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { requireAdmin } from "@/lib/auth/session";
import {
  FIELD,
  isUserId,
  parseUserForm,
  type UserFormState,
} from "@/lib/users/form";
import {
  countActiveAdmins,
  createUser,
  deleteUser,
  disableUser,
  enableUser,
  getUser,
  updateUser,
} from "@/lib/users/service";

/**
 * Every action re-checks `requireAdmin()`: a Server Action is its own entry
 * point, so the page's gate does not cover it. The auth server checks the role
 * again on top of that — see `lib/users/service.ts`.
 */

export async function createUserAction(
  _prevState: UserFormState | null,
  formData: FormData,
): Promise<UserFormState> {
  await requireAdmin();

  const parsed = parseUserForm(formData, "create");

  if (!parsed.ok) {
    return { errors: parsed.errors, values: parsed.values };
  }

  const result = await createUser(parsed.input);

  if (!result.ok) {
    return {
      ...(result.field
        ? { errors: { [result.field]: result.message } }
        : { formError: result.message }),
      values: parsed.values,
    };
  }

  // Outside any try: `redirect` signals by throwing.
  revalidatePath("/users");
  redirect("/users");
}

export async function updateUserAction(
  _prevState: UserFormState | null,
  formData: FormData,
): Promise<UserFormState> {
  const session = await requireAdmin();

  const id = formData.get(FIELD.id);

  if (!isUserId(id)) {
    return { formError: "That account is no longer valid. Reload the page." };
  }

  const parsed = parseUserForm(formData, "edit");

  if (!parsed.ok) {
    return { errors: parsed.errors, values: parsed.values };
  }

  const existing = await getUser(db, id);

  if (!existing) {
    return { formError: "That account has been deleted.", values: parsed.values };
  }

  /*
   * Refuse to demote the last administrator. Nothing in the app can restore the
   * role afterwards, so this would strand everyone outside these pages until
   * someone runs `npm run grant-admin` against the database.
   */
  if (existing.role === "admin" && parsed.input.role !== "admin") {
    const admins = await countActiveAdmins(db);

    if (admins !== null && admins <= 1) {
      return {
        errors: {
          role: "This is the only administrator left. Promote someone else first.",
        },
        values: parsed.values,
      };
    }
  }

  const result = await updateUser(id, parsed.input, {
    currentRole: existing.role,
  });

  if (!result.ok) {
    return {
      ...(result.field
        ? { errors: { [result.field]: result.message } }
        : { formError: result.message }),
      values: parsed.values,
    };
  }

  revalidatePath("/users");

  /*
   * An administrator who just changed their own role or email has a session
   * cookie describing the old one. Sending them to the dashboard rather than
   * back to a list they may no longer be allowed to see keeps that from reading
   * as a broken page.
   */
  if (id === session.user.id && parsed.input.role !== "admin") {
    revalidatePath("/dashboard");
    redirect("/dashboard");
  }

  redirect("/users");
}

export type UserRowState = { error?: string };

/**
 * Blocks or restores sign-in for one account.
 *
 * One action for both directions, chosen by the submitted intent, so the list
 * can render a single button whose label follows the account's current state.
 */
export async function setUserDisabledAction(
  _prevState: UserRowState | null,
  formData: FormData,
): Promise<UserRowState> {
  const session = await requireAdmin();

  const id = formData.get(FIELD.id);

  if (!isUserId(id)) {
    return { error: "That account is no longer valid. Reload the page." };
  }

  const disable = formData.get("disable") === "true";

  // Better Auth refuses this too (`YOU_CANNOT_BAN_YOURSELF`); saying so here
  // keeps the message ours rather than a translated upstream code.
  if (disable && id === session.user.id) {
    return { error: "You cannot disable your own account." };
  }

  const existing = await getUser(db, id);

  if (!existing) {
    // Already gone: refresh so the stale row disappears.
    revalidatePath("/users");
    return {};
  }

  if (disable && existing.role === "admin") {
    const admins = await countActiveAdmins(db);

    if (admins !== null && admins <= 1) {
      return {
        error:
          "This is the only administrator left. Promote someone else first.",
      };
    }
  }

  const result = disable ? await disableUser(id) : await enableUser(id);

  if (!result.ok) return { error: result.message };

  revalidatePath("/users");
  return {};
}

/**
 * Deletes one account. Kept separate from the form actions: it is invoked from a
 * one-button form in the list, and reports only a message.
 */
export async function deleteUserAction(
  _prevState: UserRowState | null,
  formData: FormData,
): Promise<UserRowState> {
  const session = await requireAdmin();

  const id = formData.get(FIELD.id);

  if (!isUserId(id)) {
    return { error: "That account is no longer valid. Reload the page." };
  }

  /*
   * Better Auth has no self-delete guard of its own, so this one matters: an
   * administrator could otherwise remove the account they are signed in as and
   * be logged out mid-request.
   */
  if (id === session.user.id) {
    return { error: "You cannot delete your own account." };
  }

  const existing = await getUser(db, id);

  if (!existing) {
    revalidatePath("/users");
    return {};
  }

  if (existing.role === "admin") {
    const admins = await countActiveAdmins(db);

    if (admins !== null && admins <= 1) {
      return {
        error:
          "This is the only administrator left. Promote someone else first.",
      };
    }
  }

  const result = await deleteUser(id);

  if (!result.ok) return { error: result.message };

  revalidatePath("/users");
  return {};
}
