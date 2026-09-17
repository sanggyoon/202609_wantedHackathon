import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    // Production nginx already routes /api to FastAPI.
    return process.env.NODE_ENV === "development"
      ? [
          {
            source: "/api/cases/:path*",
            destination: "http://127.0.0.1:8000/api/cases/:path*",
          },
          {
            source: "/api/mediation/:path*",
            destination: "http://127.0.0.1:8000/api/mediation/:path*",
          },
          {
            source: "/api/complaint/card-summary",
            destination: "http://127.0.0.1:8000/api/complaint/card-summary",
          },
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
