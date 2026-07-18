import type { NextConfig } from "next";
import { loadWorkspaceEnv } from "../../packages/database/src/env";

loadWorkspaceEnv();

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "avatars.githubusercontent.com" }],
  },
  transpilePackages: ["@openforge/domain", "@openforge/database", "@openforge/discovery", "@openforge/ai", "@openforge/security"],
  experimental: {
    // Bound build-time worker fan-out for predictable CI/container resource use.
    cpus: 2,
    optimizePackageImports: ["lucide-react", "motion"]
  }
};

export default nextConfig;
