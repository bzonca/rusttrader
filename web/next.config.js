/** @type {import('next').NextConfig} */
const nextConfig = {
  // Increase serverless function timeout for Rust+ connections
  serverExternalPackages: ['@liamcottle/rustplus.js'],
};

module.exports = nextConfig;
