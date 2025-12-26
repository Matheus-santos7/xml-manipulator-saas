import type { NextConfig } from "next";
import path from "path";

// Ajuste de root para evitar warnings do Turbopack sobre múltiplos lockfiles
const nextConfig: NextConfig & { turbopack?: { root?: string } } = {
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
