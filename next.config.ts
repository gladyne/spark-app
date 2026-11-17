import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/tegangan-drop/*": ["./data/tegangan-drop/**/*"],
  },
};

export default nextConfig;
