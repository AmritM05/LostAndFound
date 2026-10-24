import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.MAGPIE_NEXT_DIST_DIR || ".next",
  trailingSlash: true,
  outputFileTracingRoot: process.cwd(),
  images: { unoptimized: true },
};
export default config;
