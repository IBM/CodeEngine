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
  experimental: {
    // to avoid timeouts between the next.js and the flask api, 
    // we increase the proxyTimeout to 2 minutes. 
    proxyTimeout: 120_000,
  },
};

module.exports = nextConfig;
