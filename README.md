# BMU WATCH

**See it. Report it. Keep BMU Safe.**

An offline-first campus security reporting Progressive Web App (PWA) for **Bayelsa Medical University (BMU)**. Students and staff can submit security concerns anonymously or with their details, even without an internet connection, and administrative security personnel (CSOs / Security Officers) manage the reports from a guarded dashboard.

> ⚠️ BMU WATCH is for **reporting security concerns** and does **not** replace emergency assistance. Users in immediate danger should contact the University's security / emergency personnel directly.

---

## Features

### Reporting app (students & staff)
- **Submit a report** — pick a category and location, describe the concern, set urgency, and optionally attach photos/PDFs.
- **Anonymous or identified** — anonymous reports never store or expose identifying details (enforced on the server and in the admin DTO).
- **Offline-first** — reports are saved to IndexedDB (Dexie) as `PENDING_SYNC` and queued; they upload automatically when connectivity returns via a `SyncManager` (idempotent on the client submission id).
- **My Reports** — track submitted reports and read/reply in the two-way conversation with security staff.
- **Installable PWA** — service worker, web manifest, and installable icons ship as static assets in `public/`.

### Admin dashboard (`/admin`)
- **Anonymous + authenticated flow** — only admins log in; there is no public student/staff registration.
- **RBAC roles** — `SUPER_ADMIN`, `CSO`, `SECURITY_OFFICER`. CSO+ can assign and change report status; user/role changes require CSO+ / SUPER_ADMIN.
- **Inbox** — review reports, respond to reporters, change status, assign to officers, open attachments.
- **Audit log** — all sensitive actions are recorded.
- **Settings** — manage report categories, locations, and users.

> **Dev access** — the only way into `/admin` is through seeded dev credentials (see `.env.example` / seed script). Never ship the seed values to production.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) |
| UI | React 18, Tailwind CSS 3, TypeScript (strict) |
| Server DB | Prisma 6 + SQLite (default: `prisma/dev.db`) |
| Sessions | jose (JWT, signed, httpOnly cookie) |
| Passwords | bcryptjs |
| Client offline | Dexie (IndexedDB) + custom `SyncManager` |
| PWAs | `public/manifest.json` + `public/sw.js` |
| Tests | Vitest + fake-indexeddb |

---

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env        # then edit AUTH_SECRET, etc.

# 3. Set up the database and seed dev admins + reference data
npm run prisma:generate
npm run prisma:deploy       # apply migrations to dev DB
npm run db:seed             # seeds categories, locations, and dev admins

# 4. Run the dev server
npm run dev                 # http://localhost:3000
```

### Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Type-generate + production build |
| `npm run start` | Start production build |
| `npm run typecheck` | Run TypeScript (`tsc --noEmit`) |
| `npm test` | Run the Vitest suite |
| `npm run lint` | Next/ESLint lint |
| `npm run db:seed` | Re-seed reference data + dev admins |
| `npm run db:studio` | Open Prisma Studio to inspect the DB |

> **Note:** On some Windows setups, `next build` prints a `@next/swc-win32-x64-msvc is not a valid Win32 application` warning. Next falls back to the WebAssembly compiler and the build still succeeds; the warning is cosmetic.

---

## Environment variables

See `.env.example` for a full template. Required:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | SQLite file URL, e.g. `file:./dev.db` (relative to `prisma/`) |
| `AUTH_SECRET` | Signs admin session JWTs. Use ≥ 32 random chars (`JWT_SECRET` is a fallback). |
| `NEXT_PUBLIC_APP_URL` | Base URL of the app |
| `UPLOAD_DIR` | *Optional* attachments dir on disk (defaults to `./uploads`) |
| `SEED_*` | Dev-only seed admin credentials |

---

## Offline sync model

1. `createLocalReport()` persists a `PENDING_SYNC` report + a `syncQueue` entry in IndexedDB. This never fails because the network is down.
2. `SyncManager.runSync()` uploads queued reports to `POST /api/reports`, idempotent on `clientSubmissionId` — retries never create duplicates.
3. Server responses are downloaded into the local copy; user replies are enqueued in a `responseOutbox` and delivered once the parent report is acknowledged.
4. When offline, `runSync()` reports `OFFLINE` and never touches the network.

The mobile/student UI surfaces sync state via a floating action button (bottom-right).

---

## Architecture overview

```
app/(app)/...            student/staff PWA routes (/, /report, /reports, /how, /offline)
app/admin/...            admin login + guarded dashboard routes
app/api/...              public + admin REST endpoints (Next.js Route Handlers)
components/              shared UI (AppShell, SyncIndicator, providers)
hooks/                   React hooks (e.g. useReferenceData)
lib/                     server logic (db, auth, audit, reportService, validation, adminDto)
lib/client/              offline layer (db=Dexie, reportRepo, syncManager, syncUi, utils)
prisma/                  schema + migrations + seed
public/                  PWA assets (manifest, SW, icons)
tests/                   Vitest suites (validation, report service, offline client)
```

### Privacy guarantee
Anonymous reports have identifying fields forced to `null`:
- at the **API boundary** (`lib/validation.ts` strips them in `validateReportCreate`),
- in **persistence** (`lib/reportService.ts` writes `null`),
- and in the **admin DTO** (`lib/adminDto.ts` returns `null`/`"Anonymous"`).

The test suite asserts all three layers.

---

## Testing

- `tests/validation.test.ts` — request validation, privacy stripping, attachment rules.
- `tests/reportService.test.ts` — report create (anon/identified/student/staff), idempotency, admin DTO privacy, two-way responses, status transitions, assignment, audit. Runs against an isolated `prisma/test.db`.
- `tests/clientOffline.test.ts` — offline persistence, sync payloads, SyncManager upload/failure/offline behavior, and the response outbox (fake-indexeddb).

```bash
npm test
```

---

## Security notes

- Admin sessions use signed JWT cookies; sensitive admin APIs are RBAC-guarded.
- Login is rate-limited.
- Uploaded attachment filenames are sanitized to prevent path traversal; only allow-listed MIME types and size limits are accepted.
- Keep `AUTH_SECRET` secret in production, change the seeded admin passwords, and run behind HTTPS (required for the PWA + secure cookies).

---

## License

Internal project for Bayelsa Medical University. All rights reserved.
