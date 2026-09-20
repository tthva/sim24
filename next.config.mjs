/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  devIndicators: false,

  // Allow mobile devices on the LAN to access the dev server.
  // (Next.js 16 — top-level allowedDevOrigins; do NOT nest under experimental.)
  allowedDevOrigins: ["192.168.1.9", "localhost"],

  images: {
    unoptimized: true,
  },

  async rewrites() {
    return [
      // CRM API (app/api/crm/**) must be reached verbatim: the generic rewrite
      // below strips "/api", which would collide with the /crm UI pages
      // (page wins over dynamic routes after rewriting). First match wins,
      // so this pass-through protects the CRM API namespace.
      {
        source: "/api/crm/:path*",
        destination: "/api/crm/:path*",
      },
      {
        source: "/api/:path*",
        destination: "/:path*",
      },
    ];
  },
};

export default nextConfig;
