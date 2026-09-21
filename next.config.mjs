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

  typescript: {
    ignoreBuildErrors: true,
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "/:path*",
      },
    ];
  },
};

export default nextConfig;
