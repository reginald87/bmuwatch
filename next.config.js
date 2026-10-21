/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Set NEXT_OUTPUT=standalone to emit a self-contained build that needs no
  // node_modules on the server. Used by scripts/build-standalone.mjs and
  // scripts/make-artifact.mjs for the prebuilt-artifact deployment path.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb"
    }
  },
  // We serve the manifest and service worker directly to keep full control
  // over the offline caching strategy rather than relying on a bundler plugin.
  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
