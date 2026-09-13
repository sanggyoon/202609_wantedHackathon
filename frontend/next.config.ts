import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    // Production nginx already routes /api to FastAPI.
    return process.env.NODE_ENV === "development"
      ? [
          {
            source: "/api/complaint/conversation/:path*",
            destination:
              "http://127.0.0.1:8000/api/complaint/conversation/:path*",
          },
        ]
      : [];
  },
};

export default nextConfig;
