/**
 * Builds the app with Next's "standalone" output.
 *
 * The standalone build traces every runtime dependency into
 * `.next/standalone/node_modules`, so the result can be uploaded to a server
 * and run with nothing but Node installed - no `npm install`, no build step
 * and no Prisma engine download on the server.
 *
 * Usage:  node scripts/build-standalone.mjs
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args, env) {
  const res = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env }
  });
  if (res.status !== 0) {
    console.error(`\n[makear] failed: ${cmd} ${args.join(" ")}`);
    process.exit(res.status ?? 1);
  }
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

if (!fs.existsSync(nextBin)) {
  console.error("[makear] next is not installed. Run `npm install` first.");
  process.exit(1);
}

console.log("[makear] prisma generate ...");
run(process.execPath, [path.join(root, "node_modules", "prisma", "build", "index.js"), "generate"]);

console.log("[makear] next build (standalone) ...");
run(process.execPath, [nextBin, "build"], { NEXT_OUTPUT: "standalone" });

const standalone = path.join(root, ".next", "standalone");
if (!fs.existsSync(standalone)) {
  console.error("[makear] .next/standalone was not produced.");
  process.exit(1);
}
console.log("[makear] standalone build ready at .next/standalone");
