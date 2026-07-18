import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ENV_FILES = [".env.local", ".env"] as const;
let loaded = false;

function parseEnvValue(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadFile(path: string) {
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    const key = match?.[1];
    const value = match?.[2];
    if (!key || value === undefined || process.env[key]) continue;
    process.env[key] = parseEnvValue(value);
  }
}

function candidateStartDirs() {
  const here = dirname(fileURLToPath(import.meta.url));
  return [...new Set([process.cwd(), here])];
}

export function loadWorkspaceEnv() {
  if (loaded && process.env.DATABASE_URL) return;

  const visited = new Set<string>();
  for (const start of candidateStartDirs()) {
    let current = start;
    for (let depth = 0; depth < 10; depth += 1) {
      if (!visited.has(current)) {
        visited.add(current);
        for (const filename of ENV_FILES) {
          const envPath = join(/* turbopackIgnore: true */ current, filename);
          if (existsSync(envPath)) loadFile(envPath);
        }
      }
      if (process.env.DATABASE_URL) {
        loaded = true;
        return;
      }
      const next = dirname(current);
      if (next === current) break;
      current = next;
    }
  }

  loaded = true;
}

export function requireDatabaseUrl() {
  loadWorkspaceEnv();
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
