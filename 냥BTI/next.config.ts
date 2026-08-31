import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  allowedDevOrigins: ["192.168.0.135"],
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
