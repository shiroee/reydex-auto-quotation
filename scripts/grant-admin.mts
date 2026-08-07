/**
 * Promotes a Reydex account to administrator, so it can manage users at /users.
 *
 *   npm run grant-admin -- --email juan@reydex.com
 *   npm run grant-admin -- --email juan@reydex.com --revoke
 *   npm run grant-admin -- --list
 *
 * This writes `neon_auth.user.role` directly, which is the one place we touch
 * Neon Auth's schema with SQL. It has to be: the app promotes people through
 * Better Auth's `admin/set-role`, and that endpoint requires the *caller* to
 * already be an administrator. Something outside that loop has to appoint the
 * first one, and this is it.
 *
 * Once one administrator exists, use the Users dashboard instead — it revokes
 * sessions and validates input, which a bare UPDATE does not. Keep this for
 * bootstrapping a new database branch and for recovering from the case the app
 * deliberately refuses to create: no enabled administrator left.
 *
 * Requires DATABASE_URL (from `npx neon@latest env pull`). The npm script loads
 * .env.local via tsx's --env-file.
 */

import { Client } from "pg";

import { requireDirectUrl } from "../db/connection";

type Args = { email?: string; revoke: boolean; list: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { revoke: false, list: false };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];

    if (key === "--revoke") {
      args.revoke = true;
    } else if (key === "--list") {
      args.list = true;
    } else if (key === "--email") {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args.email = next.trim().toLowerCase();
        i += 1;
      }
    }
  }

  return args;
}

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));

if (!args.list && !args.email) {
  fail(
    'Pass an address, e.g. --email "juan@reydex.com", or --list to see who holds what.',
  );
}

const client = new Client({ connectionString: requireDirectUrl() });

try {
  await client.connect();
} catch (cause) {
  fail(
    `Could not connect to the database. Run \`npx neon@latest env pull\` and invoke ` +
      `this through \`npm run grant-admin\` so .env.local is loaded.\n  ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
  );
}

try {
  if (args.list) {
    const { rows } = await client.query<{
      email: string;
      name: string;
      role: string | null;
      banned: boolean | null;
    }>(
      `select email, name, role, banned from neon_auth."user" order by role nulls last, email`,
    );

    if (rows.length === 0) {
      console.log(
        "\nNo accounts yet. Create one with `npm run create-user`, then promote it here.\n",
      );
    } else {
      console.log(`\n${rows.length} account${rows.length === 1 ? "" : "s"}:\n`);
      for (const row of rows) {
        const flags = [
          row.role === "admin" ? "administrator" : (row.role ?? "no role"),
          row.banned ? "disabled" : null,
        ].filter(Boolean);

        console.log(`  ${row.email.padEnd(34)} ${row.name} — ${flags.join(", ")}`);
      }
      console.log("");
    }

    process.exit(0);
  }

  const role = args.revoke ? "user" : "admin";

  const { rows } = await client.query<{ email: string; role: string | null }>(
    `update neon_auth."user" set role = $1, "updatedAt" = now() where email = $2
     returning email, role`,
    [role, args.email],
  );

  if (rows.length === 0) {
    fail(
      `No account for ${args.email}. Check the address with --list, or create it ` +
        `with \`npm run create-user\`.`,
    );
  }

  /*
   * Refuse to remove the last administrator, for the same reason the dashboard
   * does: nothing in the app can appoint a replacement afterwards. Checked after
   * the write and rolled back by re-granting, so the count includes this change
   * rather than racing it.
   */
  if (args.revoke) {
    const { rows: admins } = await client.query<{ n: number }>(
      `select count(*)::int as n from neon_auth."user"
       where role = 'admin' and coalesce(banned, false) = false`,
    );

    if (admins[0].n === 0) {
      await client.query(
        `update neon_auth."user" set role = 'admin' where email = $1`,
        [args.email],
      );

      fail(
        `${args.email} is the only enabled administrator, so the role was kept. ` +
          `Grant it to someone else first.`,
      );
    }
  }

  console.log(
    args.revoke
      ? `\n✔ ${args.email} is no longer an administrator.\n`
      : `\n✔ ${args.email} is now an administrator.\n  They can manage accounts at /users.\n`,
  );

  /*
   * Better Auth reads the role from the session cookie for up to five minutes
   * (`sessionDataTtl`), so a change made here can take that long to show up for
   * someone already signed in.
   */
  console.log("  Already signed in? Sign out and back in for this to take effect.\n");
} finally {
  await client.end();
}
