import type { NextConfig } from "next";

const isGitHubPages = process.env.DEPLOY_TARGET === "github-pages";
const repositoryBasePath = "/Release-Friday";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: isGitHubPages ? repositoryBasePath : "",
  assetPrefix: isGitHubPages ? `${repositoryBasePath}/` : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
