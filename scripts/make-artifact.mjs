/**
 * Packages a prebuilt, self-contained deployment artifact.
 *
 * The artifact contains everything the server needs to run BMU WATCH:
 *
 *   server.js          standalone entry point (from server.standalone.js)
 *   .next/             traced build output + static assets
 *   public/            manifest, service worker, icons
 *   node_modules/      traced runtime deps, incl. the Linux Prisma engine
 *   prisma/            schema.prisma + migrations (for future migrations)
 *   tools/             Prisma CLI + tsx, so migrations and the production
 *                      seed can run on the server with no network access
 *
 * The server then needs nothing but Node: no npm install, no next build and
 * no Prisma engine download.
 *
 * Usage:
 *   node scripts/build-standalone.mjs      (or npm run build:standalone)
 *   node scripts/make-artifact.mjs
 *
 * Output: dist/bmuwatch-artifact.tar.gz  (+ .sha256)
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const stage = path.join(dist, "bmuwatch-artifact");
const artifactName = "bmuwatch-artifact";

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd ?? root,
    stdio: "inherit",
    env: { ...process.env, ...opts.env }
  });
  if (res.status !== 0) {
    console.error(`[artifact] failed: ${cmd} ${args.join(" ")}`);
    process.exit(res.status ?? 1);
  }
}

function mustExist(p, hint) {
  if (!fs.existsSync(p)) {
    console.error(`[artifact] missing ${p}${hint ? ` - ${hint}` : ""}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------- build ----
const standalone = path.join(root, ".next", "standalone");
mustExist(standalone, "run `npm run build:standalone` first");

console.log("[artifact] staging ...");
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

// Traced runtime deps + .next/server + BUILD_ID + required-server-files.json
fs.cpSync(standalone, stage, { recursive: true });

// Static assets live outside the trace and must be copied in by hand.
fs.cpSync(path.join(root, ".next", "static"), path.join(stage, ".next", "static"), { recursive: true });
fs.cpSync(path.join(root, "public"), path.join(stage, "public"), { recursive: true });

// Schema + migrations, so the server can apply future migrations.
fs.mkdirSync(path.join(stage, "prisma"), { recursive: true });
fs.cpSync(path.join(root, "prisma", "schema.prisma"), path.join(stage, "prisma", "schema.prisma"));
fs.cpSync(path.join(root, "prisma", "migrations"), path.join(stage, "prisma", "migrations"), { recursive: true });

// The standalone entry point becomes the artifact's server.js.
fs.cpSync(path.join(root, "server.standalone.js"), path.join(stage, "server.js"));

// Minimal package.json: enough for `node server.js` and for Passenger.
fs.writeFileSync(
  path.join(stage, "package.json"),
  JSON.stringify(
    {
      name: "bmu-watch",
      version: "0.1.0",
      private: true,
      description: "BMU WATCH - prebuilt deployment artifact (standalone build)",
      main: "server.js",
      scripts: { start: "node server.js" }
    },
    null,
    2
  ) + "\n"
);

// ---------------------------------------------------------------- tools ----
// A self-contained toolchain for `prisma migrate deploy` and the production
// seed, so neither step needs network access on the server.
const tools = path.join(stage, "tools");
fs.mkdirSync(tools, { recursive: true });
fs.writeFileSync(
  path.join(tools, "package.json"),
  JSON.stringify(
    {
      name: "bmu-watch-tools",
      version: "0.1.0",
      private: true,
      description: "Prisma CLI + tsx for migrations and seeding on the server",
      scripts: { "db:seed:prod": "tsx seed.prod.ts" },
      dependencies: {
        "@prisma/client": "6.19.3",
        bcryptjs: "^2.4.3",
        prisma: "6.19.3",
        tsx: "^4.19.2"
      }
    },
    null,
    2
  ) + "\n"
);

console.log("[artifact] installing toolchain (prisma CLI + tsx) ...");
run("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], { cwd: tools });

// Generate the Prisma client against the app schema (the toolchain ships
// without a schema of its own, so @prisma/client's own postinstall cannot
// generate it).
console.log("[artifact] generating prisma client for tools/ ...");
run(process.execPath, [path.join(tools, "node_modules", "prisma", "build", "index.js"), "generate", "--schema", path.join(stage, "prisma", "schema.prisma")], { cwd: tools });

// The production seed script, resolved against tools/node_modules.
fs.cpSync(path.join(root, "prisma", "seed.prod.ts"), path.join(tools, "seed.prod.ts"));
fs.cpSync(path.join(root, "prisma", "reference-data.ts"), path.join(tools, "reference-data.ts"));

// ----------------------------------------------------------------- pack ----
const tarPath = path.join(dist, `${artifactName}.tar.gz`);
fs.rmSync(tarPath, { force: true });

// --sort=name + fixed ownership/mtime keep the archive reproducible.
run("tar", [
  "--sort=name",
  "--owner=0",
  "--group=0",
  "--numeric-owner",
  "--mtime=@0",
  "-czf",
  tarPath,
  "-C",
  stage,
  "."
]);

const hash = crypto.createHash("sha256").update(fs.readFileSync(tarPath)).digest("hex");
fs.writeFileSync(`${tarPath}.sha256`, `${hash}  ${artifactName}.tar.gz\n`);

const bytes = fs.statSync(tarPath).size;
console.log("");
console.log("[artifact] done");
console.log(`  archive : ${path.relative(root, tarPath)} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
console.log(`  sha256  : ${hash}`);
console.log("");
console.log("Upload the archive to the server and extract it into the app root:");
console.log("  tar -xzf bmuwatch-artifact.tar.gz -C ~/bmuwatch");
