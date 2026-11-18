import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets several dev servers run side by side (e.g. NEXT_DIST_DIR=.next-alt).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
