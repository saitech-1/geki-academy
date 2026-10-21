import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  experimental: {
    // Match the API's 500 MiB source limit, with multipart overhead.
    proxyClientMaxBodySize: "512mb",
    proxyTimeout: 30 * 60 * 1000,
  },
  transpilePackages: ["@geki/contracts"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_INTERNAL_URL || "http://127.0.0.1:4000"}/api/:path*`,
      },
    ];
  },
};
export default nextConfig;
