/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module — exclude it from bundling so Next.js
  // loads it via require() at runtime instead of trying to pack it.
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};

module.exports = nextConfig;
