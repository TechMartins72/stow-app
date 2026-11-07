import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Asset logos from the True Markets catalog. Only these hosts; anything else falls back to initials.
    remotePatterns: [
      { protocol: "https", hostname: "coin-images.coingecko.com", pathname: "/coins/images/**" },
      { protocol: "https", hostname: "api.elbstream.com", pathname: "/logos/**" },
    ],
  },
  experimental: {
    // In dev, Next reuses fetch responses across hot reloads, even `no-store` ones.
    // Balances must always be live, so turn that off.
    serverComponentsHmrCache: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
