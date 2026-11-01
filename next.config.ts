import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // Keep production checks within laptop and two-core CI build memory budgets.
  experimental: { cpus: 2 },
  outputFileTracingExcludes: {
    "/*": [
      "./.env*",
      "./.local/**/*",
      "./apps/**/*",
      "./design/**/*",
      "./tests/**/*",
    ],
  },
  transpilePackages: ["@geki/contracts"],
  async headers() {
    return [
      {
        source: "/geki-sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  async redirects() {
    return ["/pricing", "/library", "/checkout"].map((source) => ({
      source,
      destination: "/courses",
      permanent: true,
    }));
  },
};
export default nextConfig;
