/**
 * Static export: the site is hosted on GitHub Pages (epistudent.fr). Every data access goes
 * from the browser to Supabase, secured by RLS and security-definer RPCs.
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  transpilePackages: ["@studybuddy/ui", "@studybuddy/db"],
};

export default nextConfig;
