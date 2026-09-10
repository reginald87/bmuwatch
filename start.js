process.env.NODE_ENV = "production";

const { createServer } = require("http");
const next = require("next");

const app = next({ dev: false });
const handle = app.getRequestHandler();

const PORT = process.env.PORT || 3000;

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(PORT, () => {
    console.log(`BMU WATCH running on http://localhost:${PORT}`);
  });
});
