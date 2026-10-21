/**
 * Standalone entry point for BMU WATCH (cPanel / Passenger).
 *
 * Used when the production bundle is built ahead of time with the
 * "standalone" output and uploaded to the server as a prebuilt artifact.
 * In that layout the app root contains Next's own traced node_modules, so
 * the usual `next()` bootstrap cannot be used: the standalone trace omits
 * `next/dist/compiled/webpack/*`, which `loadConfig()` requires.
 *
 * `startServer()` is therefore started directly with the config baked into
 * `.next/required-server-files.json` at build time - exactly what Next's own
 * generated standalone entry point does - with two additions:
 *
 *   1. graceful SIGTERM/SIGINT shutdown, so Passenger can restart the app
 *      without dropping in-flight requests,
 *   2. a startup log line, so cPanel's log panel shows a healthy boot.
 *
 * scripts/make-artifact.mjs copies this file to the artifact root as
 * "server.js", which is the value to enter in cPanel's
 * "Application startup file" field.
 */

const fs = require("fs");
const path = require("path");

process.env.NODE_ENV = "production";

const dir = __dirname;
process.chdir(dir);

const PORT = Number(process.env.PORT) || 3000;
const HOSTNAME = process.env.HOSTNAME || "0.0.0.0";

const configPath = path.join(dir, ".next", "required-server-files.json");
if (!fs.existsSync(configPath)) {
  console.error(`[bmu-watch] missing ${configPath} - the production build was not uploaded.`);
  process.exit(1);
}

const { config: nextConfig } = JSON.parse(fs.readFileSync(configPath, "utf8"));
process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig);

const { startServer } = require("next/dist/server/lib/start-server");

let server;

startServer({
  dir,
  isDev: false,
  config: nextConfig,
  hostname: HOSTNAME,
  port: PORT,
  allowRetry: false
})
  .then((s) => {
    server = s;
    console.log(`[bmu-watch] ready on http://${HOSTNAME}:${PORT} (production)`);
  })
  .catch((err) => {
    console.error("[bmu-watch] failed to start:", err);
    process.exit(1);
  });

// Passenger sends SIGTERM before restarting the app: close the server
// cleanly so in-flight requests are not dropped.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    if (server) {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 5000).unref();
    } else {
      process.exit(0);
    }
  });
}
