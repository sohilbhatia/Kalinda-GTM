import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Prevent Turbopack from treating a parent `package-lock.json` as the monorepo root (empty/broken dev responses)
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
