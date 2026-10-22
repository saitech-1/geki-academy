import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/*": ["./.env*", "./.local/**/*", "./apps/**/*", "./design/**/*", "./tests/**/*"],
  },
  transpilePackages: ["@geki/contracts"],
  async redirects() {
    return ["/pricing", "/library", "/checkout"].map((source) => ({
      source,
      destination: "/courses",
      permanent: true,
    }));
  },
};
export default nextConfig;
