import type { NextConfig } from "next";

// Local development: serve the VoxelCraft browser game at the root of port 3000.
// The upstream project builds a static export with basePath "/Surprise564" for
// GitHub Pages (see docs/STRUCTURE.md). For local dev we keep the game at root.
const nextConfig: NextConfig = {
  reactStrictMode: false,
};

export default nextConfig;
