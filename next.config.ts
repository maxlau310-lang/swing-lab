import type { NextConfig } from "next";

/**
 * Static HTML export. Camera, upload, MediaPipe, and the 3D viewer all run
 * in the browser, so Cloudflare Pages can host `out/` on the free plan.
 * There is no Node server in production.
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
