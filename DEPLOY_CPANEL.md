# BMU WATCH — cPanel Deployment Guide (step by step)

Target stack: **Next.js 15 (App Router) + Prisma 6 (SQLite) + Passenger** running under cPanel's
**Setup Node.js App** (CloudLinux Node.js Selector).

Assumptions (change the placeholders for your account):

| Placeholder | Example | Notes |
| --- | --- | --- |
| `cpaneluser` | `bmuadmin` | your cPanel/SSH username |
| `domain` | `watch.bmu.edu.ng` | the subdomain/hostname that will serve the app |
| `/home/cpaneluser/bmuwatch` | app root | **outside** `public_html` |
| `/home/cpaneluser/bmuwatch-data` | data root | SQLite DB + uploaded attachments |

---

## 0. Target layout on the server

```
/home/cpaneluser/
├── bmuwatch/                    <-- Next.js app (cPanel "Application root")
│   ├── .env                     <-- production secrets (chmod 600)
│   ├── server.js                <-- cPanel startup file
│   ├── node_modules/            <-- installed ON the server (Linux binaries)
│   ├── .next/                   <-- production build
│   └── ...
├── bmuwatch-data/               <-- data root (NEVER in public_html)
│   ├── prod.db                  <-- SQLite database
│   └── uploads/                 <-- report attachments
└── public_html/                 <-- cPanel document root (holds the proxy .htaccess)
```

**Why the data root is outside the app root:** Passenger watches the app directory and restarts the
app whenever a file changes. If the SQLite DB or the uploads folder lived inside `bmuwatch/`, every
incoming report would restart your app. It also keeps the DB and attachments off the web.

---

## Phase 0 — Prerequisites (do these first)

1. **cPanel features.** Confirm `Software → Setup Node.js App` and `Terminal` (or SSH) exist.
   `MultiPHP Manager` is irrelevant here.
2. **Node.js version.** In `Setup Node.js App`, select **Node.js 20.x or 22.x**. Next.js 15 will not
   run on Node 16/18.0.
3. **RAM.** The server-side build (`next build`) needs ~1.5–2 GB. Check your limit over SSH:
   ```bash
   free -m
   node -e "console.log('cpus', require('os').cpus().length, 'mem GB', (require('os').totalmem()/1073741824).toFixed(1))"
   ```
   If you have less than ~2 GB, use **Appendix A** (build on your own machine) instead of Phase 8.
4. **DNS.** `domain` must already point to the cPanel server IP (`A` record). Check with
   `nslookup domain` from your PC.
5. **SSL.** `SSL/TLS Status → Run AutoSSL` (Let's Encrypt) — mandatory, because the PWA service
   worker and the `secure` admin cookie only work over HTTPS.

---

## Phase 1 — Prepare the code locally

The repo already contains everything the server needs (no changes required on your side):

| File | Purpose |
| --- | --- |
| `server.js` | cPanel/Passenger entry point. Listens on cPanel's `PORT`. |
| `package.json` → `postinstall` | Runs `prisma generate` automatically during `npm install` (downloads the **Linux** Prisma engine). |
| `package.json` → `prisma`, `tsx` in `dependencies` | So `prisma migrate deploy` / seeding still work if dev deps are skipped. |
| `prisma/seed.prod.ts` | Production bootstrap: creates admins from env vars, seeds categories/locations, **no demo reports**. |

Generate a strong `AUTH_SECRET` (32+ chars) — do this on your machine, not on the server:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Commit and push your work so the server can pull it (Phase 3). `git status` should be clean.

---

## Phase 2 — Create the folders on the server (SSH / cPanel Terminal)

```bash
cd ~
mkdir -p bmuwatch-data/uploads
mkdir -p bmuwatch-data/backups
chmod 750 bmuwatch-data bmuwatch-data/uploads
```

`bmuwatch-data` must be writable by your user — this is where SQLite and attachments live.

---

## Phase 3 — Upload the code

### Option A (recommended, repeatable): Git

1. Create a **private** repo on GitHub/GitLab and push this project:
   ```powershell
   git remote add origin https://github.com/<you>/bmuwatch.git
   git push -u origin main
   ```
2. On the server (SSH / cPanel Terminal):
   ```bash
   cd ~
   git clone https://github.com/<you>/bmuwatch.git bmuwatch
   cd bmuwatch
   ```
   cPanel's `Git™ Version Control` panel can also do the clone, but only if the repo is private —
   use a **deploy key** or a personal access token, never your account password.

### Option B (one-off): archive + scp from Windows

```powershell
# from the project folder: produces a zip of tracked files only
# (node_modules, .next, .env and .git are excluded automatically)
git archive --format=zip -o ..\bmuwatch-deploy.zip HEAD
scp ..\bmuwatch-deploy.zip cpaneluser@your.server.host:/home/cpaneluser/
```
```bash
# on the server
cd ~ && unzip bmuwatch-deploy.zip -d bmuwatch
```

> **Never upload the `node_modules` folder from Windows.** Prisma ships native binaries compiled for
> your OS; Windows binaries will crash on Linux. `node_modules` is always installed on the server.

---

## Phase 4 — Create the Node.js application in cPanel

`cPanel → Software → Setup Node.js App → Create Application`:

| Field | Value |
| --- | --- |
| Node.js version | **20.x** (or 22.x) |
| Application mode | **Production** |
| Application root | `bmuwatch` |
| Application URL | `domain` (e.g. `watch.bmu.edu.ng`) |
| Application startup file | `server.js` |
| Startup arguments | *(leave empty)* |

Click **Create Application**. cPanel writes a Passenger reverse-proxy `.htaccess` into the document
root (`public_html`, or `public_html/<domain>` for a subdomain) — do not delete it.

> **Do NOT add `NODE_ENV=production` to the environment-variable box.** cPanel's own
> "Run NPM Install" button installs with `--production` when `NODE_ENV=production` is set, which
> skips `typescript` and `@types/*` — the server-side build in Phase 8 then fails. `server.js`
> already forces `NODE_ENV=production` at runtime.

---

## Phase 5 — Install dependencies on the server (SSH)

```bash
cd ~/bmuwatch
npm install --include=dev --no-audit --no-fund
```

The `postinstall` hook runs `prisma generate`, which downloads the **Linux** Prisma engine. Verify:

```bash
npx prisma -v
```
You should see `Computed binaryTarget : debian-openssl-3.0.x` (or `rhel-openssl-3.0.x`).

> If you prefer cPanel's **Run NPM Install** button, use it and then still run
> `npm install --include=dev` over SSH so the dev dependencies are present for the build.

---

## Phase 6 — Configure `.env` and create the database

### 6a. Write the production `.env`

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

Notes:

* `DATABASE_URL` is an **absolute** path. If Prisma rejects it, use the triple-slash form:
  `file:///home/cpaneluser/bmuwatch-data/prod.db`.
* `UPLOAD_DIR` must be writable and outside the app root.
* `AUTH_SECRET` must be different for every environment. Rotating it logs all admins out.
* The `ADMIN_*` values are only used by the seed script (Phase 7). You can move them to
  `~/bmuwatch-data/admin.env` (chmod 600) afterwards and source them when you need to rotate a
  password.

### 6b. Apply the database migrations

```bash
cd ~/bmuwatch
npx prisma migrate deploy
npx prisma migrate status     # should say: Database schema is up to date
```

`migrate deploy` creates `prod.db` automatically. Confirm it exists:

```bash
ls -lh ~/bmuwatch-data/
```

---

## Phase 7 — Create the production admin accounts

```bash
cd ~/bmuwatch
npm run db:seed:prod
```

This creates the super admin from `ADMIN_*`, seeds the 13 categories and 12 locations, and creates
**no demo reports**. Optionally add a CSO and a security officer by also setting `CSO_EMAIL`,
`CSO_PASSWORD`, `OFFICER_EMAIL`, `OFFICER_PASSWORD` in `.env` before running it.

To **rotate a password later** (there is no UI for it): change the value in the env file and re-run
`npm run db:seed:prod` — it upserts and re-hashes the password.

---

## Phase 8 — Build the production bundle

```bash
cd ~/bmuwatch
NODE_OPTIONS=--max-old-space-size=2048 npm run build
```

Expected tail of the output:

```
Route (app)                      Size
...
+ First Load JS shared by all    103 kB
```

* If you get `FATAL: JavaScript heap out of memory`, lower the number, or use **Appendix A**.
* The build must run **on the server** unless you follow Appendix A — do not upload a
  Windows-built `.next` as your main path.

---

## Phase 9 — Start the application

1. cPanel → `Setup Node.js App` → click **Restart Application** next to `bmuwatch`.
2. Watch the log at the bottom of the Node.js App page. A healthy start shows:
   ```
   [bmu-watch] ready on http://0.0.0.0:3000 (production)
   ```
3. Open `https://domain` — you should get the BMU WATCH home page.
4. Open `https://domain/admin` → you should get the admin login screen.

---

## Phase 10 — Domain, HTTPS and the PWA

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

## Phase 11 — End-to-end verification checklist

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

## Phase 12 — Operations

### Daily backup (cPanel → Cron Jobs)

```bash
15 2 * * * cp /home/cpaneluser/bmuwatch-data/prod.db /home/cpaneluser/bmuwatch-data/backups/prod-$(date +\%F).db && find /home/cpaneluser/bmuwatch-data/backups -name 'prod-*.db' -mtime +14 -delete
```

(In cPanel cron the `%` must be escaped as `\%`.) Add a second weekly job that zips `uploads/`.

### Updating the app later

```bash
cd ~/bmuwatch
git pull
npm install --include=dev --no-audit --no-fund
npx prisma migrate deploy      # applies any new migrations
NODE_OPTIONS=--max-old-space-size=2048 npm run build
```
Then `Restart Application` in cPanel.

### Log files

Application stdout/stderr: `~/logs/` (or the log link in the `Setup Node.js App` panel).

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `502` / "Application failed to start" | Startup file is not `server.js`, or `.next` build is missing, or `node_modules` is missing | Confirm the startup file, re-run Phase 8, re-run `npm install` |
| `Error: Cannot find module '.prisma/client'` | `prisma generate` never ran | `cd ~/bmuwatch && npx prisma generate` |
| `Your version of Node.js is not supported` | Node 16/18 selected | Re-create the app with Node 20/22 |
| Build: `Cannot find module 'typescript'` | dev deps were skipped (cPanel "Run NPM Install" with `NODE_ENV=production`) | `npm install --include=dev` over SSH |
| Build: `JavaScript heap out of memory` | Not enough RAM | Lower `NODE_OPTIONS`, ask the host to raise the limit, or use Appendix A |
| Prisma: `Cannot find engine / Failed to download` | Server cannot reach `binaries.prisma.sh` | `export PRISMA_ENGINES_MIRROR=https://npmmirror.com/mirrors/prisma` and re-run `npx prisma generate` |
| Prisma: `P1013 The database file could not be found` | `bmuwatch-data` missing or wrong path | `mkdir -p ~/bmuwatch-data`, re-check `DATABASE_URL` |
| `EACCES: permission denied` writing uploads | `bmuwatch-data/uploads` not writable | `chmod 750 ~/bmuwatch-data/uploads` and check `UPLOAD_DIR` |
| App restarts every time a report arrives | DB/uploads are inside the app root | Move `DATABASE_URL` + `UPLOAD_DIR` to `~/bmuwatch-data` and restart |
| Admin login fails but credentials are right | `AUTH_SECRET` changed between restarts, or the DB is empty | Confirm `AUTH_SECRET` is in `.env` and the app was restarted; re-run `npm run db:seed:prod` |
| Service worker not registering | HTTP, or `sw.js` not served | Enable HTTPS; check `curl -I https://domain/sw.js` |
| Login page loops / redirect issues behind the proxy | The proxy is not passing `Host` / `X-Forwarded-Proto` | cPanel's Node app mapping preserves the host by default; if you added a custom proxy, forward `Host`, `X-Forwarded-Host` and `X-Forwarded-Proto` |
| Attachment downloads 404 | `UPLOAD_DIR` changed after the files were stored | Keep `UPLOAD_DIR` constant for the life of the installation |

---

## Appendix A — Hosts without enough RAM to build on the server

Build the bundle on a Linux machine and copy only the build output. WSL2 is the easiest option on
Windows:

```bash
# inside WSL2 (Ubuntu)
cd ~/projects/bmuwatch
npm ci
npm run build
```
Then copy `.next/` and `public/` to `~/bmuwatch/` on the server (or upload a tarball of them), and
on the server run only:

```bash
cd ~/bmuwatch
npm install --omit=dev --no-audit --no-fund   # production deps only
npx prisma generate
```
`npx prisma` still works because `prisma` is in `dependencies`.

> Do **not** upload a `.next` folder built on Windows as your main path: some absolute paths and
> optional native modules differ. If you must, delete `.next/cache` before packaging and expect
> `next start` to complain about `required-server-files.json` paths.

---

## Appendix B — Hardening checklist before going live

- [ ] `AUTH_SECRET` is random, ≥ 32 chars, unique to this installation.
- [ ] The seeded admin password was rotated (`npm run db:seed:prod` with a new `ADMIN_PASSWORD`).
- [ ] `npm run db:seed` (the **dev** seed) was never run on the server — it creates the well-known
      `superadmin@bmuwatch.dev / SuperAdmin!12345` accounts and three demo reports.
- [ ] `~/bmuwatch/.env` is `chmod 600` and the app root is not inside `public_html`.
- [ ] `public_html` (or the subdomain docroot) contains only the cPanel proxy `.htaccess`.
- [ ] SSL is active and HTTPS redirect is on.
- [ ] The daily backup cron job exists and you have restored a backup once to prove it works.
- [ ] `NEXT_TELEMETRY_DISABLED=1` in `.env` (optional, silences Next.js telemetry).

---

## Appendix C — Command quick reference

```bash
# --- one-time setup ---
cd ~ && mkdir -p bmuwatch-data/uploads && chmod 750 bmuwatch-data bmuwatch-data/uploads
git clone https://github.com/<you>/bmuwatch.git bmuwatch && cd bmuwatch
npm install --include=dev --no-audit --no-fund
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
NODE_OPTIONS=--max-old-space-size=2048 npm run build

# --- restart after config changes ---
# cPanel -> Setup Node.js App -> Restart Application

# --- update ---
cd ~/bmuwatch && git pull && npm install --include=dev && npx prisma migrate deploy && npm run build
```
