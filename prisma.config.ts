import { defineConfig } from "prisma/config";
import { loadWorkspaceEnv } from "./packages/database/src/env";

loadWorkspaceEnv();

// Prisma CLI schema operations should use DIRECT_URL (the direct Neon
// connection); DATABASE_URL is the pooled runtime URL used by the app/worker.
const datasourceUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!datasourceUrl) {
  throw new Error("DIRECT_URL or DATABASE_URL must be configured before running Prisma CLI commands.");
}

export default defineConfig({
  schema: "packages/database/prisma/schema.prisma",
  migrations: {
    path: "packages/database/prisma/migrations"
  },
  datasource: {
    url: datasourceUrl
  }
});
