/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
