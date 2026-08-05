"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import {
  describeSignInError,
  normalizeEmail,
  safeRedirectPath,
  SERVICE_UNAVAILABLE_MESSAGE,
  validateSignInInput,
  type SignInFormState,
} from "@/lib/auth/credentials";

export async function signInWithEmail(
  _prevState: SignInFormState | null,
  formData: FormData,
): Promise<SignInFormState> {
  const rawEmail = formData.get("email");
  const submittedEmail =
    typeof rawEmail === "string" ? normalizeEmail(rawEmail) : "";

  const validation = validateSignInInput({
    email: rawEmail,
    password: formData.get("password"),
  });

  if (!validation.ok) {
    return { fieldErrors: validation.fieldErrors, email: submittedEmail };
  }

  let signInError: { code?: string | null; message?: string | null } | null;

  try {
    const result = await auth.signIn.email(validation.credentials);
    signInError = result.error;
  } catch (cause) {
    // The SDK re-throws non-transport failures. A sign-in screen should degrade
    // to an inline message rather than an error boundary, so swallow it here and
    // keep the detail server-side.
    console.error("[auth] sign-in failed unexpectedly", cause);
    return { formError: SERVICE_UNAVAILABLE_MESSAGE, email: submittedEmail };
  }

  if (signInError) {
    return {
      formError: describeSignInError(signInError),
      email: submittedEmail,
    };
  }

  // Must stay outside the try/catch above: `redirect` signals by throwing.
  redirect(safeRedirectPath(formData.get("next")));
}

export async function signOut() {
  await auth.signOut();
  redirect("/login");
}
