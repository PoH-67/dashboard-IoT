import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    // TeamGallery renders photos at quality 70; 75 is Next's default.
    qualities: [70, 75],
  },
};

export default nextConfig;
