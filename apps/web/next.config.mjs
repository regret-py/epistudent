/**
 * Static export hosted on GitHub Pages (epistudent.fr). No backend: data lives in localStorage.
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  transpilePackages: ["@studybuddy/ui"],
};

export default nextConfig;
