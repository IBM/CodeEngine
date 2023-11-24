/** @type {import('next').NextConfig} */
const nextConfig = {
  rewrites: async () => {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:5328/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
