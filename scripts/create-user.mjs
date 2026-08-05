#!/usr/bin/env node
/**
 * Provisions a Reydex staff account.
 *
 *   npm run create-user -- --email juan@reydex.com --name "Juan Dela Cruz"
 *
 * Self-service registration is blocked in `app/api/auth/[...path]/route.ts`, so
 * this operator script talks to the Neon Auth server directly. The password is
 * taken from REYDEX_NEW_USER_PASSWORD when set, otherwise prompted for without
 * echo — pass it on the command line only if you accept it landing in your
 * shell history.
 *
 * Requires NEON_AUTH_BASE_URL (from `npx neon@latest env pull`). The npm script
 * loads .env.local via `node --env-file`.
 */

import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

/** Better Auth's default minimum; keep in step with the auth config. */
const MIN_PASSWORD_LENGTH = 8;

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;

    const name = key.slice(2);
    const next = argv[i + 1];

    if (next === undefined || next.startsWith("--")) {
      args[name] = true;
    } else {
      args[name] = next;
      i += 1;
    }
  }

  return args;
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

/** Reads a line from the TTY with echo suppressed. */
function promptHidden(question) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY) {
      reject(
        new Error(
          "No TTY available for a password prompt. Set REYDEX_NEW_USER_PASSWORD instead.",
        ),
      );
      return;
    }

    const rl = createInterface({ input: stdin, output: stdout, terminal: true });

    // Swallow the echoed characters while the answer is being typed.
    const onKeypress = () => {
      stdout.write(`\r${question}`);
    };

    stdout.write(question);
    stdin.on("data", onKeypress);

    rl.question("", (answer) => {
      stdin.off("data", onKeypress);
      rl.close();
      stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!baseUrl) {
    fail(
      "NEON_AUTH_BASE_URL is not set. Run `npx neon@latest env pull` first, " +
        "and invoke this through `npm run create-user` so .env.local is loaded.",
    );
  }

  const email = typeof args.email === "string" ? args.email.trim().toLowerCase() : "";
  if (!email || !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email)) {
    fail('Pass a valid address, e.g. --email "juan@reydex.com".');
  }

  const name = typeof args.name === "string" ? args.name.trim() : email;

  let password =
    typeof args.password === "string"
      ? args.password
      : process.env.REYDEX_NEW_USER_PASSWORD;

  if (!password) {
    password = await promptHidden(`Password for ${email}: `);
  }

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    fail(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/sign-up/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Better Auth validates the request origin against the trusted-domain
      // list; localhost is trusted for development by default.
      Origin: process.env.REYDEX_APP_ORIGIN ?? "http://localhost:3000",
    },
    body: JSON.stringify({ email, name, password }),
  });

  const raw = await response.text();

  if (!response.ok) {
    let detail = raw;
    try {
      const parsed = JSON.parse(raw);
      detail = parsed.message ?? parsed.error ?? raw;
    } catch {
      // Non-JSON error body; fall through with the raw text.
    }

    if (response.status === 403) {
      detail +=
        "\n  Hint: add this origin to the trusted list with " +
        "`npx neon@latest neon-auth domain add <origin>`, or set REYDEX_APP_ORIGIN.";
    }

    fail(`Neon Auth rejected the request (${response.status}). ${detail}`);
  }

  let userId = "unknown";
  try {
    userId = JSON.parse(raw).user?.id ?? "unknown";
  } catch {
    // The account was created even if the body is not what we expected.
  }

  console.log(`\n✔ Created ${email}`);
  console.log(`  name:    ${name}`);
  console.log(`  user id: ${userId}`);
  console.log(`\n  They can now sign in at /login.\n`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
