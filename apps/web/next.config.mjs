/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@studybuddy/ui", "@studybuddy/db"],
  poweredByHeader: false,
};

export default nextConfig;
