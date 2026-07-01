import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Prevent Turbopack from picking up /home/jordan/package-lock.json as the monorepo root.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
