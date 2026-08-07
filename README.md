# Reydex Quotations

Quotation system for **Reydex Fire Extinguisher Trading**, built on Next.js 16
(App Router) with Neon for the database and authentication.

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Unauthenticated visitors land on `/login`.

### Branding and icons

The corporate lockup lives at **`public/images/Logo text no outline.png`**.
`lib/brand.ts` resolves it at startup — including its intrinsic dimensions, so
the mark is never stretched — and falls back to a gold vector stand-in
(`assets/reydex-mark.svg`) if no logo file is found.

`Logo text no outline.png` is preferred over `Logo high res.png`: it is cropped
tight to the artwork, and its transparent pixels are clean black rather than
carrying a leftover olive gradient that can fringe when resized.

Because the lockup already contains the word REYDEX, the UI only draws the
typographic wordmark when falling back to the stand-in.

Browser and app icons are generated from the same artwork:

```bash
npm run make-icons            # dragon shield only (default)
npm run make-icons -- --full  # keep the REYDEX wordmark
```

This writes `app/favicon.ico` (16/32/48px), `app/icon.png` (192px) and
`app/apple-icon.png` (180px), which Next.js wires into `<head>` automatically
via the metadata file conventions. The script finds the empty band between the
shield and the wordmark from the alpha channel and crops there, because the
wordmark is illegible below about 32px. Re-run it after replacing the logo.

## Environment

`.env.local` is git-ignored and holds:

| Variable                  | Source                                    |
| ------------------------- | ----------------------------------------- |
| `DATABASE_URL`            | `npx neon@latest env pull`                |
| `DATABASE_URL_UNPOOLED`   | `npx neon@latest env pull`                |
| `NEON_AUTH_BASE_URL`      | `npx neon@latest env pull`                |
| `NEON_AUTH_JWKS_URL`      | `npx neon@latest env pull`                |
| `NEON_AUTH_COOKIE_SECRET` | Generate once: `openssl rand -base64 32`  |

The workspace is linked to the Neon project `reydex`
(branch `production`) via the git-ignored `.neon` file. To re-pull Neon values
after switching branches:

```bash
npx neon@latest checkout <branch-name>   # creates/pins the branch and pulls env
```

## Accounts

Self-service registration is **disabled** — the sign-up endpoints are blocked in
`app/api/auth/[...path]/route.ts`. Staff accounts are provisioned by an
administrator:

```bash
npm run create-user -- --email juan@reydex.com --name "Juan Dela Cruz"
```

The password is prompted for without echo, or read from
`REYDEX_NEW_USER_PASSWORD` in non-interactive use. Existing users can be listed
or removed with the Neon CLI:

```bash
npx neon@latest neon-auth user delete <user-id>
```

> When deploying to a real domain, add it to Neon Auth's trusted list first,
> otherwise sign-in fails with `invalid domain`:
>
> ```bash
> npx neon@latest neon-auth domain add https://app.reydex.com
> ```

### The Users dashboard

Day to day, accounts are managed at **`/users`** rather than from the command
line: add, edit, disable / re-enable, reset a password, and delete. It is
visible only to administrators, and the navigation hides it from everyone else.

Accounts are held by Neon Auth, not by this app's database, so the dashboard
drives Better Auth's *admin* endpoints (`auth.admin.*` in `lib/users/service.ts`)
rather than writing SQL — that is what hashes passwords and revokes a disabled
user's live sessions. The only local data involved is how many quotations each
account has prepared, from `quotations.prepared_by_user_id`.

**Roles.** `Staff` raises quotations and maintains the catalogue; `Administrator`
can also manage accounts. `admin` is the role Better Auth's admin plugin checks
for, so it is an authorisation level rather than a job title.

**Appointing the first administrator** needs a database write, because the
endpoint that grants the role requires the caller to already hold it:

```bash
npm run grant-admin -- --list                          # who holds what
npm run grant-admin -- --email juan@reydex.com         # promote
npm run grant-admin -- --email juan@reydex.com --revoke
```

After that, use the dashboard. Keep the script for bootstrapping a fresh
database branch and for the one case the app refuses to create: no enabled
administrator left. Both the dashboard and the script decline to remove the last
one.

**Disable vs delete.** Disabling blocks sign-in and drops the account's live
sessions, and is reversible — it is Better Auth's `ban`, which is why a blocked
sign-in reports "This account has been disabled". Deleting is not reversible; it
is safe for documents already issued, since each quotation stores its own
signatory name and title and keeps only a soft link to the account, but that
link — who prepared it — is lost.

> A role change can take up to five minutes to be reflected for someone already
> signed in, because the SDK serves the session from a signed cookie for
> `sessionDataTtl`. It is cosmetic only: the auth server re-checks the role on
> every admin call, so a stale cookie claiming `admin` cannot act on it. Signing
> out and back in applies it immediately.
>
> Note also that `admin/create-user` does **not** enforce a minimum password
> length (unlike `sign-up/email`, which returns `PASSWORD_TOO_SHORT`), and
> `admin/set-role` accepts role strings it does not recognise. Both floors are
> held by `lib/users/form.ts`, which is unit tested — don't route around it.

## Database

Schema is managed as code with Drizzle; `db/schema.ts` is the source of truth.

```bash
npm run db:generate   # write SQL to db/migrations after editing db/schema.ts
npm run db:migrate    # apply pending migrations (direct, unpooled connection)
npm run db:seed       # load the catalogue — idempotent, safe to re-run
npm run db:studio     # browse the data
```

Driver is `node-postgres`, not `@neondatabase/serverless`: creating a quotation
writes header, line items and total in one interactive transaction, and the
serverless driver needs a WebSocket global that Node 20 does not provide.
`db/connection.ts` pins `sslmode=verify-full` — Neon issues URLs with
`sslmode=require`, which `pg` 9 will reinterpret with weaker semantics.

### Model notes

Two decisions worth knowing before extending it:

- **Price is keyed on (product, service kind, capacity)**, not on product. A
  10 lb dry-chemical unit is ₱1,200 brand new but ₱600 to refill, and the 50 lb
  refill is ₱3,000. Superseded prices stay as history via `effective_to`; a
  partial unique index keeps exactly one live price per variant.
- **`quotation_items` stores a full snapshot** of what was quoted (name,
  description, specs, capacity, unit, price). Editing the catalogue must never
  restate a quotation that has already gone out. `product_id` is only a soft
  backlink and is nulled if the catalogue entry is deleted. `line_total` is a
  Postgres generated column so a line can never disagree with its own inputs.

Application tables live in `public`. Neon Auth owns `neon_auth` and
re-provisions it per branch, so nothing here holds a foreign key into it —
user ids are stored by value.

`quotation_presets` holds the three reusable boilerplate sets found in the
sample quotations (brand-new supply, refilling & servicing, PM proposal),
including the full scope of works and exclusions.

## Quotations

Two layouts, matching the sample documents:

| Template           | Shape                                                                            |
| ------------------ | -------------------------------------------------------------------------------- |
| `supply`           | Per-item spec panels, each with its own quantity/price table, then a grand total |
| `service_proposal` | One consolidated costing table, amount in words, scope of works, exclusions      |

Raise one at **/quotations/new**: pick a customer and a type, add items, save.
The item picker offers *price variants* rather than products, because a name
alone cannot be priced — "DRY CHEMICAL TYPE" is ₱1,200 new and ₱600 to refill.
The running total is computed with the same integer-centavo arithmetic Postgres
uses for the stored one, so the preview cannot disagree with the saved figure.

`npm run db:seed-samples -- --reset` rebuilds the three sample quotations from
the catalogue and asserts each total against the original PDF — a cheap
end-to-end check that products, price variants, presets, snapshots and totals
still line up.

Open one at `/quotations`, then **Print / Save as PDF**. Set the browser's
margins to *None*: the letterhead is part of the page and repeats on every sheet
via a `position: fixed` header, so browser headers would double up.

Some behaviour that is deliberate rather than incidental:

- **Consecutive lines for the same product collapse into one ITEM block** with a
  row per capacity. The Umicore sample shows the 10 lb and 50 lb refills under a
  single "ITEM 1: DRY CHEMICAL TYPE", not as two numbered items.
- **The capacity column appears per block**, not per document — the smoke
  detector table has no capacity column, the extinguisher table does.
- **Column headings follow the service kind**: brand-new tables read TOTAL PRICE,
  refill tables read AMOUNT, as in the samples.
- Print CSS names Calibri and Times New Roman first, so output on a Windows
  machine matches the original Word documents.

## How auth is wired

| File                              | Role                                                         |
| --------------------------------- | ------------------------------------------------------------ |
| `lib/auth/server.ts`              | Neon Auth (Managed Better Auth) server instance              |
| `lib/auth/client.ts`              | Browser client for client-side session reads                 |
| `lib/auth/session.ts`             | `getSession()` / `requireSession()` / `requireAdmin()`       |
| `lib/auth/credentials.ts`         | Pure validation + visitor-safe error mapping (unit tested)   |
| `app/api/auth/[...path]/route.ts` | Auth API proxy, with sign-up blocked                         |
| `proxy.ts`                        | Optimistic cookie-only route protection (Next 16 middleware) |
| `app/login/`                      | Branded sign-in screen and its Server Action                 |
| `lib/users/`, `app/users/`        | Account administration (the Users dashboard)                 |

Two layers guard protected routes: `proxy.ts` turns away unauthenticated
traffic cheaply, and `requireSession()` runs inside each page and Server Action
— the proxy check is optimistic and reads only the cookie, so it is never the
sole defence.

> **`proxy.ts` deliberately only guards GET/HEAD.** In SDK 0.4.2-beta,
> `auth.middleware()` validates the session by forwarding the incoming request
> to the auth server's `get-session` endpoint, which answers **415 Unsupported
> Media Type** for anything that is not a plain GET. On a matched route that
> turns every Server Action POST into a redirect to `loginUrl` before the action
> runs — which silently broke both the quotation builder and sign-out (the
> redirect looked like success while the session survived). Auth on those POSTs
> comes from `requireSession()` inside the action; this is verified by a test
> that submits a valid action payload with no session and confirms nothing is
> written. Re-check this if the SDK is upgraded.

## Scripts

```bash
npm run dev          # dev server (Turbopack)
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest run
npm run create-user  # provision a staff account
npm run grant-admin  # appoint (or list) administrators — see Accounts
npm run make-icons   # regenerate favicon / app icons from the logo
```

`npm run typecheck` relies on route types generated into `.next/`, so run
`npm run build` (or `npm run dev`) at least once after adding a route.
