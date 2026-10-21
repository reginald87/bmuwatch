/**
 * cPanel / Passenger entry point for BMU WATCH.
 *
 * cPanel's "Setup Node.js App" starts the application with this file and
 * proxies every HTTP request to it, so the app must listen on the port
 * cPanel injects through the PORT environment variable.
 *
 * Set in cPanel -> Setup Node.js App:
 *   Application startup file : server.js
 *   Startup arguments        : (leave empty)
 */

process.env.NODE_ENV = process.env.NODE_ENV || "production";

const { createServer } = require("http");
const next = require("next");

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

const PORT = Number(process.env.PORT) || 3000;

let server;

app.prepare().then(() => {
  server = createServer((req, res) => handle(req, res));
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[bmu-watch] ready on http://0.0.0.0:${PORT} (${process.env.NODE_ENV})`);
  });
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
