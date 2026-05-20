/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async rewrites() {
    return [
      {
        source: "/api/agent/:path*",
        destination: `${process.env.AGENT_BASE_URL}/agent/:path*`,
      },
      {
        source: "/api/session/:path*",
        destination: `${process.env.AGENT_BASE_URL}/session/:path*`,
      },
      {
        source: "/api/graph/:path*",
        destination: `${process.env.AGENT_BASE_URL}/graph/:path*`,
      },
    ];
  },
};

export default nextConfig;
