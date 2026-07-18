import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Add the existing Neon/Postgres connection string to the workspace .env file or the process environment.",
    );
  }
  return url;
}

export function databaseTargetSummary() {
  const url = requireDatabaseUrl();
  try {
    const parsed = new URL(url);
    return { host: parsed.host, database: parsed.pathname.replace(/^\//, "") || "default" };
  } catch {
    return { host: "unparseable DATABASE_URL", database: "unknown" };
  }
}

function createClient() {
  const adapter = new PrismaPg({ connectionString: requireDatabaseUrl() });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "./generated/prisma/client.js";
