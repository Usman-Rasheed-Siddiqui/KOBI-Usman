import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@openforge/database";

const github = process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? {
  github: { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }
} : {};

export const auth = betterAuth({
  appName: "KOBI",
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.KOBI_BASE_URL ?? process.env.OPENFORGE_BASE_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET ?? "development-only-change-me-KOBI-secret",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, minPasswordLength: 10 },
  socialProviders: github,
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "USER", input: false }
    }
  },
  rateLimit: { enabled: true, window: 60, max: 80 }
});
