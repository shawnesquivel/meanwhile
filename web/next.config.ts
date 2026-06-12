import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared API contract lives at ../shared (monorepo root). Turbopack
  // refuses to resolve outside its root, so point the root one level up.
  turbopack: {
    root: path.join(process.cwd(), ".."),
  },
  // Same allowance for webpack-based builds.
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
