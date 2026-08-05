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

## How auth is wired

| File                              | Role                                                         |
| --------------------------------- | ------------------------------------------------------------ |
| `lib/auth/server.ts`              | Neon Auth (Managed Better Auth) server instance              |
| `lib/auth/client.ts`              | Browser client for client-side session reads                 |
| `lib/auth/session.ts`             | `getSession()` / `requireSession()` — the real access gate   |
| `lib/auth/credentials.ts`         | Pure validation + visitor-safe error mapping (unit tested)   |
| `app/api/auth/[...path]/route.ts` | Auth API proxy, with sign-up blocked                         |
| `proxy.ts`                        | Optimistic cookie-only route protection (Next 16 middleware) |
| `app/login/`                      | Branded sign-in screen and its Server Action                 |

Two layers guard protected routes: `proxy.ts` turns away unauthenticated
traffic cheaply, and `requireSession()` runs inside each page — the proxy check
is optimistic and reads only the cookie, so it is never the sole defence.

## Scripts

```bash
npm run dev          # dev server (Turbopack)
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest run
npm run create-user  # provision a staff account
npm run make-icons   # regenerate favicon / app icons from the logo
```

`npm run typecheck` relies on route types generated into `.next/`, so run
`npm run build` (or `npm run dev`) at least once after adding a route.
