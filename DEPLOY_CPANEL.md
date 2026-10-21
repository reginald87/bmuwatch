# BMU WATCH — cPanel Deployment Guide (TrueHost)

Target stack: **Next.js 15.5 (App Router) + Prisma 6 (SQLite) + Passenger**, running under cPanel's
**Setup Node.js App** (CloudLinux Node.js Selector).

Every command and figure in this guide has been executed and verified on Linux (Node 20.19.4,
Ubuntu) against this repository — see the "Verified behaviour" appendix for the measured numbers.

---

## Deployment paths at a glance

| | **A — prebuilt `.next`** ⭐ | **B — build on the server** | **C — cPanel Git™ panel** | **D — standalone artifact** |
|---|---|---|---|---|
| Code source | `git clone` over SSH | `git clone` over SSH | cPanel GUI clone | uploaded tarball |
| Build runs on | your Linux machine | **the server** | **the server** | your Linux machine |
| Upload to server | **13 MB** (`.next` only) | 0 (source only) | 0 | 124 MB |
| Server needs `npm install` | yes, `--omit=dev` (26 s) | yes, `--include=dev` | yes, `--include=dev` | **no** |
| Server needs network for npm | yes | yes | yes | **no** |
| Server needs build RAM | none | ~600 MB | ~600 MB | none |
| Update flow | rebuild + re-upload `.next` | `git pull` + rebuild | GUI button + rebuild | rebuild + re-upload |

**Recommended: Path A.** It keeps the server free of build work (no RAM risk on a shared host),
the transfer is only 13 MB, and the server still gets its source from GitHub, so `git pull` remains
the update mechanism for code changes. Path B is the fallback when you cannot build on Linux
locally. Paths C and D are documented for completeness.

> **Do not upload `node_modules` from Windows.** Prisma ships native binaries compiled per OS;
> Windows binaries crash on Linux. `node_modules` is always installed on the server (Paths A/B/C)
> or shipped as a Linux build (Path D).

---

## Phase 0 — Prerequisites

1. **cPanel features.** `Software → Setup Node.js App` and `Terminal` (or SSH) must exist.
   `MultiPHP Manager` is irrelevant here.
2. **Node.js version.** Select **Node.js 20.x or 22.x** in `Setup Node.js App`. Next.js 15
   requires `^18.18.0 || ^19.8.0 || >= 20.0.0`; 20 LTS is the recommended production version.
3. **Disk space.** Paths A/B/C need ~1.5 GB free (`node_modules` + `.next` + npm cache).
   Path D needs ~2 GB.
4. **DNS.** The domain must already point at the cPanel server IP (`A` record).
5. **SSL.** `SSL/TLS Status → Run AutoSSL` (Let's Encrypt) — mandatory: the PWA service worker
   and the `secure` admin cookie only work over HTTPS.

---

## Phase 1 — Target layout on the server

```
/home/cpaneluser/
├── bmuwatch/                    <-- Next.js app (cPanel "Application root")
│   ├── .env                     <-- production secrets (chmod 600)
│   ├── server.js                <-- startup file
│   ├── node_modules/            <-- installed ON the server (Linux binaries)
│   ├── .next/                   <-- production build
│   └── ...
├── bmuwatch-data/               <-- data root (NEVER in public_html)
│   ├── prod.db                  <-- SQLite database
│   └── uploads/                 <-- report attachments
└── public_html/                 <-- document root (holds the proxy .htaccess)
```

**Why the data root is outside the app root:** Passenger watches the app directory and restarts the
app whenever a file changes. If the SQLite DB or the uploads folder lived inside `bmuwatch/`, every
incoming report would restart your app. It also keeps the DB and attachments off the web.

---

## Phase 2 — Create the data folders (SSH / cPanel Terminal)

```bash
cd ~
mkdir -p bmuwatch-data/uploads
mkdir -p bmuwatch-data/backups
chmod 750 bmuwatch-data bmuwatch-data/uploads
```

---

## Phase 3 — Get the code onto the server

### Path A / B — Git over SSH (recommended)

The repository is **public**, so no credentials, token or deploy key is needed:

```bash
cd ~
git clone https://github.com/reginald87/bmuwatch.git bmuwatch
cd bmuwatch
```

Updates are a plain `git pull` from the app root.

> If you ever make the repository private, switch to an SSH clone with a deploy key (never your
> account password):
> ```bash
> # 1. Generate a key pair ON THE SERVER
> ssh-keygen -t ed25519 -C "bmuwatch-cpanel" -f ~/.ssh/bmuwatch_deploy -N ""
> # 2. Add the PUBLIC key to the GitHub repo: Settings -> Deploy keys -> Add deploy key
> cat ~/.ssh/bmuwatch_deploy.pub
> # 3. Point git at that key, then clone
> git config --global core.sshCommand "ssh -i ~/.ssh/bmuwatch_deploy -o IdentitiesOnly=yes"
> git clone git@github.com:<you>/bmuwatch.git bmuwatch
> ```

### Path C — cPanel Git™ Version Control panel (no git CLI needed)

1. `cPanel → Files → Git Version Control → Create Repository`.
2. **Repository Path**: `bmuwatch-repo` (keep it outside the app root and outside `public_html`).
3. **Repository URL**: `https://github.com/reginald87/bmuwatch.git`. The repository is public, so
   cPanel clones it with no username, token or SSH key.
4. Save. Then `Manage → Update from Remote` to pull, and `Manage → Pull or Deploy → Deploy HEAD
   Commit` to run the tasks in `.cpanel.yml`.
5. `.cpanel.yml` is committed at the repository root. **Edit the `DEPLOYPATH` line to your own
   cPanel username** before the first deploy:

   ```yaml
   deployment:
     tasks:
       - export DEPLOYPATH=/home/cpaneluser/bmuwatch
       - mkdir -p $DEPLOYPATH
       - tar -cf - --exclude=.git --exclude=node_modules --exclude=.next --exclude=.env . | (cd $DEPLOYPATH && tar -xf -)
       - cd $DEPLOYPATH
       - npm ci --include=dev --no-audit --no-fund
       - npx prisma migrate deploy
       - npm run build
   ```

   The `tar` copy keeps the app root's `node_modules`, `.next` and `.env` intact; the build then
   runs *in* the app root so Passenger finds the output where it expects it.

### Path D — Upload a prebuilt artifact

See "Path D" below.

---

## Phase 4 — Create the Node.js application in cPanel

`cPanel → Software → Setup Node.js App → Create Application`:

| Field | Value |
| --- | --- |
| Node.js version | **20.x** (or 22.x) |
| Application mode | **Production** |
| Application root | `bmuwatch` |
| Application URL | your domain (e.g. `watch.bmu.edu.ng`) |
| Application startup file | `server.js` |
| Startup arguments | *(leave empty)* |

Click **Create Application**. cPanel writes a Passenger reverse-proxy `.htaccess` into the document
root (`public_html`, or `public_html/<domain>` for a subdomain) — do not delete it.

> **cPanel 138+ (Meridian theme) alternative.** Newer cPanel versions expose a **Web Apps** feature
> that deploys a Node.js app straight from a Git repository URL, a ZIP upload, or an MCP
> connection. Because the repository is public, `https://github.com/reginald87/bmuwatch.git` can be
> pasted straight in with no credentials. Check `cPanel → Application Manager` / `Web Apps` first; if
> it is available it will run the build and the npm install for you. The manual flow below works on
> every cPanel version and gives you control over the build flags, so it remains the reference.

> **Do NOT add `NODE_ENV=production` to the environment-variable box.** cPanel's "Run NPM Install"
> button installs with `--production` when `NODE_ENV=production` is set, which skips `typescript`
> and `@types/*` — the server-side build then fails. `server.js` already forces `NODE_ENV=production`
> at runtime.

---

## Phase 5 — Install dependencies on the server

### Path A (recommended)

```bash
cd ~/bmuwatch
npm ci --omit=dev --no-audit --no-fund
```

75 packages, ~26 s. This installs `next`, `react`, `@prisma/client` (with the **Linux** Prisma
engine), the `prisma` CLI, `tsx` and `dotenv` — everything the runtime and the admin scripts need.

> `--omit=dev` is safe here because `prisma`, `tsx` and `dotenv` are declared in `dependencies`
> (not `devDependencies`) precisely so they survive a production install. `package-lock.json` is
> kept in sync with `package.json`, so `npm ci` never fails on a lock mismatch.

### Path B / C

```bash
cd ~/bmuwatch
npm ci --include=dev --no-audit --no-fund
```

252 packages, ~30 s. The dev dependencies are required for `next build` (typescript).

> If you prefer cPanel's **Run NPM Install** button, use it and then still run
> `npm ci --include=dev` over SSH so the dev dependencies are present for the build.

### Verify the Prisma engine is the Linux one

```bash
npx prisma -v
```

Expect `Computed binaryTarget : debian-openssl-3.0.x` (or `rhel-openssl-3.0.x`).

> If the server cannot reach `binaries.prisma.sh`:
> ```bash
> export PRISMA_ENGINES_MIRROR=https://npmmirror.com/mirrors/prisma && npx prisma generate
> ```

---

## Phase 6 — Write the production `.env`

```bash
cat > ~/bmuwatch/.env <<'EOF'
DATABASE_URL="file:/home/cpaneluser/bmuwatch-data/prod.db"
AUTH_SECRET="PASTE_THE_64_CHARACTER_SECRET_HERE"
NEXT_PUBLIC_APP_URL="https://watch.bmu.edu.ng"
UPLOAD_DIR="/home/cpaneluser/bmuwatch-data/uploads"

ADMIN_NAME="BMU WATCH Administrator"
ADMIN_EMAIL="security@bmu.edu.ng"
ADMIN_PASSWORD="PASTE_A_STRONG_PASSWORD_HERE"
EOF
chmod 600 ~/bmuwatch/.env
```

Generate the secret on **your own machine**, not on the server:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Notes:

* `DATABASE_URL` is an **absolute** path. If Prisma rejects it, use the triple-slash form:
  `file:///home/cpaneluser/bmuwatch-data/prod.db`.
* `UPLOAD_DIR` must be writable and outside the app root.
* `AUTH_SECRET` must be unique per environment. Rotating it logs all admins out.
* The `ADMIN_*` values are used only by the production seed (Phase 7). You can move them to
  `~/bmuwatch-data/admin.env` (chmod 600) afterwards and source them when you need to rotate a
  password.

---

## Phase 7 — Apply the database migrations

```bash
cd ~/bmuwatch
npx prisma migrate deploy
npx prisma migrate status     # should say: Database schema is up to date
```

`migrate deploy` creates `prod.db` automatically:

```bash
ls -lh ~/bmuwatch-data/
```

---

## Phase 8 — Create the production admin accounts

```bash
cd ~/bmuwatch
npm run db:seed:prod
```

This creates the super admin from `ADMIN_*`, seeds the 13 categories and 12 locations, and creates
**no demo reports**. Optionally add a CSO and a security officer by also setting `CSO_EMAIL`,
`CSO_PASSWORD`, `OFFICER_EMAIL`, `OFFICER_PASSWORD` in `.env` before running it.

> The seed script loads `.env` itself (`import "dotenv/config"`). Running it with plain `tsx`
> would otherwise fail with `Missing required environment variable: ADMIN_EMAIL`, because tsx does
> not read `.env` the way the Prisma CLI does.

To **rotate a password later** (there is no UI for it): change the value in the env file and re-run
`npm run db:seed:prod` — it upserts and re-hashes the password.

---

## Phase 9 — Build

### Path A — build on your own Linux machine, upload `.next` (recommended)

Build on Linux (WSL2 is the easiest option on Windows; Docker also works):

```bash
# inside WSL2 (Ubuntu) or a Linux container
cd ~/projects/bmuwatch
npm ci
npm run build
```

Then upload **only the build output** — 13 MB compressed:

```powershell
# from the project folder on Windows, using WSL2's tar:
wsl -d Ubuntu -- bash -lc "cd ~/projects/bmuwatch && tar -czf /mnt/c/temp/bmuwatch-next.tar.gz .next"
scp C:\temp\bmuwatch-next.tar.gz cpaneluser@your.server.host:/home/cpaneluser/
```

```bash
# on the server
cd ~/bmuwatch
tar -xzf ~/bmuwatch-next.tar.gz
```

> The `.next` folder must be built on Linux. A Windows-built `.next` embeds Windows absolute
> paths and native-module differences and is not supported.

### Path B / C — build on the server

```bash
cd ~/bmuwatch
npm run build
```

The build peaks at **~600 MB** of RAM and takes about **60 seconds** — small enough for a typical
shared-hosting account, but it *is* subject to the account's CloudLinux memory limit.

> **Do not set `NODE_OPTIONS=--max-old-space-size=2048`** unless the account really has that much
> memory. If the account limit is 1024 MB, telling V8 it may use 2 GB means V8 will not garbage
> collect in time and the process gets killed by the OS instead of failing gracefully. Leave the
> default, or set it to match the account limit:
> ```bash
> free -m   # check your actual limit
> NODE_OPTIONS=--max-old-space-size=1024 npm run build
> ```

---

## Phase 10 — Start the application

1. cPanel → `Setup Node.js App` → **Restart Application**.
2. Watch the log at the bottom of the Node.js App page. A healthy start shows:
   ```
   [bmu-watch] ready on http://0.0.0.0:3000 (production)
   ```
3. Open `https://domain` — you should get the BMU WATCH home page.
4. Open `https://domain/admin` → the admin login screen.

---

## Phase 11 — Domain, HTTPS and the PWA

1. **SSL:** `SSL/TLS Status → Run AutoSSL`. Wait for the certificate to issue.
2. **Force HTTPS:** `Domains → domain → Force HTTPS Redirect: ON`. (If the toggle breaks the
   Passenger proxy, turn it off and add the redirect manually to the document root `.htaccess`:
   ```apache
   RewriteEngine On
   RewriteCond %{HTTPS} !=on
   RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
   ```
   )
3. **Memory limit (optional):** add to the document root `.htaccess` (the one cPanel generated):
   ```apache
   PassengerMemoryLimit 1024M
   ```
4. **PWA check:** on Android Chrome/Edge, open `https://domain` → menu → *Install app*. The
   manifest (`/manifest.json`) and service worker (`/sw.js`) are plain files in `public/`, so they
   are served automatically. Service workers require HTTPS — over plain HTTP the app still works but
   the offline queue will not.

---

## Phase 12 — End-to-end verification checklist

Run through this list before telling anyone the app is live:

| # | Check | How |
| --- | --- | --- |
| 1 | Home page loads | `curl -I https://domain` → `200` |
| 2 | Manifest + icons | `curl -I https://domain/manifest.json` → `200`; `curl -I https://domain/sw.js` → `200` |
| 3 | Admin login | `https://domain/admin` → sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you seeded |
| 4 | Submit a report | `https://domain/report` → send one as a student (identified) and one anonymous |
| 5 | Inbox shows it | `/admin/inbox` → both reports visible; the anonymous one shows **no** identifying fields |
| 6 | Reply to the reporter | Reply from the inbox → the reply appears in *My Reports* on the phone |
| 7 | Attachment upload + download | Attach a photo → it appears in the inbox → click it and it downloads |
| 8 | Offline queue | Turn off data on the phone, submit a report, turn data back on → it syncs automatically, no duplicate |
| 9 | DB is not web-readable | `curl -I https://domain/bmuwatch-data/prod.db` → `404` |
| 10 | Uploads are not web-readable | `curl -I https://domain/uploads/att-xxxx.png` → `404` |
| 11 | Restart survives | `Restart Application` in cPanel → pages still work, existing reports still there |
| 12 | Attachments persisted | Restart the app, then open an attachment again → it still downloads |

---

## Phase 13 — Operations

### Daily backup (cPanel → Cron Jobs)

```bash
15 2 * * * cp /home/cpaneluser/bmuwatch-data/prod.db /home/cpaneluser/bmuwatch-data/backups/prod-$(date +\%F).db && find /home/cpaneluser/bmuwatch-data/backups -name 'prod-*.db' -mtime +14 -delete
```

(In cPanel cron the `%` must be escaped as `\%`.) Add a second weekly job that zips `uploads/`.

### Updating the app later

**Path A** (source changes only, no rebuild needed for code edits that do not touch the bundle —
in practice: always rebuild):

```bash
# on your Linux machine
cd ~/projects/bmuwatch && git pull && npm ci && npm run build
wsl -d Ubuntu -- bash -lc "cd ~/projects/bmuwatch && tar -czf /mnt/c/temp/bmuwatch-next.tar.gz .next"
scp C:\temp\bmuwatch-next.tar.gz cpaneluser@your.server.host:/home/cpaneluser/
```

```bash
# on the server
cd ~/bmuwatch && git pull && npm ci --omit=dev && tar -xzf ~/bmuwatch-next.tar.gz && npx prisma migrate deploy
```

Then `Restart Application` in cPanel.

**Path B**:

```bash
cd ~/bmuwatch && git pull && npm ci --include=dev && npx prisma migrate deploy && npm run build
```

Then `Restart Application` in cPanel.

### Log files

Application stdout/stderr: `~/logs/` (or the log link in the `Setup Node.js App` panel).

---

## Path D — Fully self-contained artifact (no npm on the server)

Use this when the server has no reliable npm access, or when you want the app root to be a single
immutable unit.

```bash
# on your Linux machine
cd ~/projects/bmuwatch
npm ci
npm run build:standalone     # emits .next/standalone
npm run artifact             # writes dist/bmuwatch-artifact.tar.gz + .sha256
```

The archive contains `server.js` (a standalone entry point with graceful shutdown), the traced
`node_modules` including the **Linux** Prisma engine, `.next/`, `public/`, `prisma/` (schema and
migrations) and a `tools/` folder holding the Prisma CLI and `tsx`.

Upload and install:

```bash
# on the server
cd ~
mkdir -p bmuwatch
tar -xzf bmuwatch-artifact.tar.gz -C bmuwatch
cd bmuwatch
# .env exactly as in Phase 6
npx prisma migrate deploy --schema prisma/schema.prisma
npx tsx seed.prod.ts        # tools/ is added to PATH by the command below
```

More precisely, the offline commands are:

```bash
cd ~/bmuwatch
export DATABASE_URL="file:/home/cpaneluser/bmuwatch-data/prod.db"
export ADMIN_NAME="BMU WATCH Administrator"
export ADMIN_EMAIL="security@bmu.edu.ng"
export ADMIN_PASSWORD="..."

node tools/node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma
node tools/node_modules/tsx/dist/cli.mjs tools/seed.prod.ts
```

Then point cPanel's **Application startup file** at `server.js` (the artifact's own entry point) and
press **Restart Application**.

> The artifact's `server.js` is `server.standalone.js` from the repository. It starts Next through
> `startServer()` with the config baked into `.next/required-server-files.json`, because the
> standalone trace omits `next/dist/compiled/webpack/*` and the usual `next()` bootstrap cannot
> load a config in that layout. It also handles `SIGTERM`/`SIGINT`, which Next's generated
> standalone entry point does not — Passenger sends `SIGTERM` on restart, and without a handler
> in-flight requests are dropped.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `502` / "Application failed to start" | Startup file is not `server.js`, or `.next` is missing/incomplete, or `node_modules` is missing | Confirm the startup file, re-run Phase 9, re-run `npm ci` |
| `Error: Cannot find module '.prisma/client'` | `prisma generate` never ran | `cd ~/bmuwatch && npx prisma generate` |
| `npm ci` → "package.json and package-lock.json are not in sync" | Lock file out of date | `npm install` locally and commit the updated `package-lock.json` |
| `Your version of Node.js is not supported` | Node 16/18 selected | Re-create the app with Node 20/22 |
| Build: `Cannot find module 'typescript'` | dev deps were skipped | `npm ci --include=dev` over SSH |
| Build: `JavaScript heap out of memory` | Account memory limit too low | Lower `NODE_OPTIONS`, or use Path A (build locally) |
| Build: killed with no error | CloudLinux LVE killed the process | Check `lveinfo` / ask the host to raise the limit, or use Path A |
| Prisma: `Cannot find engine / Failed to download` | Server cannot reach `binaries.prisma.sh` | `export PRISMA_ENGINES_MIRROR=https://npmmirror.com/mirrors/prisma` then `npx prisma generate` |
| Prisma: `P1013 The database file could not be found` | `bmuwatch-data` missing or wrong path | `mkdir -p ~/bmuwatch-data`, re-check `DATABASE_URL` |
| `EACCES: permission denied` writing uploads | `bmuwatch-data/uploads` not writable | `chmod 750 ~/bmuwatch-data/uploads` and check `UPLOAD_DIR` |
| Seed: `Missing required environment variable: ADMIN_EMAIL` | `.env` not loaded | Run `npm run db:seed:prod` from the app root (the script loads `.env` itself) |
| App restarts every time a report arrives | DB/uploads are inside the app root | Move `DATABASE_URL` + `UPLOAD_DIR` to `~/bmuwatch-data` and restart |
| Admin login fails but credentials are right | `AUTH_SECRET` changed between restarts, or the DB is empty | Confirm `AUTH_SECRET` is in `.env`; re-run `npm run db:seed:prod` |
| Service worker not registering | HTTP, or `sw.js` not served | Enable HTTPS; check `curl -I https://domain/sw.js` |
| Login page loops / redirect issues behind the proxy | The proxy is not passing `Host` / `X-Forwarded-Proto` | cPanel's Node app mapping preserves the host by default; if you added a custom proxy, forward `Host`, `X-Forwarded-Host` and `X-Forwarded-Proto` |
| Attachment downloads 404 | `UPLOAD_DIR` changed after the files were stored | Keep `UPLOAD_DIR` constant for the life of the installation |

---

## Appendix A — Hardening checklist before going live

- [ ] `AUTH_SECRET` is random, ≥ 32 chars, unique to this installation.
- [ ] The seeded admin password was rotated (`npm run db:seed:prod` with a new `ADMIN_PASSWORD`).
- [ ] `npm run db:seed` (the **dev** seed) was never run on the server — it creates the well-known
      `superadmin@bmuwatch.dev / SuperAdmin!12345` accounts and three demo reports.
- [ ] `~/bmuwatch/.env` is `chmod 600` and the app root is not inside `public_html`.
- [ ] `public_html` (or the subdomain docroot) contains only the cPanel proxy `.htaccess`.
- [ ] SSL is active and the HTTPS redirect is on.
- [ ] The daily backup cron job exists and you have restored a backup once to prove it works.
- [ ] `NEXT_TELEMETRY_DISABLED=1` in `.env` (optional, silences Next.js telemetry).

---

## Appendix B — Verified behaviour

Measured on Linux (Node 20.19.4, Ubuntu 26.04, 8 cores) against this repository:

| Measurement | Value |
| --- | --- |
| `npm ci` (with dev deps) | 252 packages, ~30 s |
| `npm ci --omit=dev` | 75 packages, ~26 s |
| `next build` | ~60 s, **peak RSS 595 MB** |
| Prisma engine on Linux | `debian-openssl-3.0.x` |
| `.next` (non-standalone) upload | **13.2 MB** compressed |
| Standalone artifact | 124.4 MB compressed |
| Standalone server boot | 103 ms |

End-to-end checks executed against a running instance of this build:

* `GET /`, `/admin/login`, `/report`, `/manifest.json`, `/sw.js`, `/api/categories`,
  `/api/locations` → all `200`
* `POST /api/reports` (anonymous) → `201`, `WATCH-2026-000001`, identifying fields `null`
* `POST /api/reports` (identified) → `201`, `WATCH-2026-000002`, identifying fields retained
* `POST /api/admin/login` → `200` with a session cookie
* `GET /api/admin/dashboard`, `/api/admin/reports`, `/admin/inbox` → `200` with the session cookie
* `npm run db:seed:prod` → 1 admin, 13 categories, 12 locations, **0 demo reports**
* `SIGTERM` → the process exits cleanly (Passenger restarts do not drop requests)

---

## Appendix C — Command quick reference

```bash
# --- one-time setup (Paths A/B) ---
cd ~ && mkdir -p bmuwatch-data/uploads bmuwatch-data/backups
chmod 750 bmuwatch-data bmuwatch-data/uploads
git clone https://github.com/reginald87/bmuwatch.git bmuwatch && cd bmuwatch
npm ci --omit=dev --no-audit --no-fund          # Path A  (add --include=dev for Path B)
cat > .env <<'EOF'
DATABASE_URL="file:/home/cpaneluser/bmuwatch-data/prod.db"
AUTH_SECRET="..."
NEXT_PUBLIC_APP_URL="https://watch.bmu.edu.ng"
UPLOAD_DIR="/home/cpaneluser/bmuwatch-data/uploads"
ADMIN_NAME="BMU WATCH Administrator"
ADMIN_EMAIL="security@bmu.edu.ng"
ADMIN_PASSWORD="..."
EOF
chmod 600 .env
npx prisma migrate deploy
npm run db:seed:prod
tar -xzf ~/bmuwatch-next.tar.gz                 # Path A only (uploaded build output)
npm run build                                   # Path B only (build on the server)

# --- restart after config changes ---
# cPanel -> Setup Node.js App -> Restart Application

# --- update (Path A) ---
cd ~/bmuwatch && git pull && npm ci --omit=dev && npx prisma migrate deploy && tar -xzf ~/bmuwatch-next.tar.gz
# --- update (Path B) ---
cd ~/bmuwatch && git pull && npm ci --include=dev && npx prisma migrate deploy && npm run build
```
