import dns from "node:dns/promises";
import net from "node:net";

const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^0\./
];

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return PRIVATE_V4.some((pattern) => pattern.test(ip));
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:") || normalized === "::";
  }
  return true;
}

export async function assertSafePublicUrl(rawUrl: string, approvedHosts?: Set<string>): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only HTTP(S) URLs are allowed");
  if (url.username || url.password) throw new Error("Credential-bearing URLs are not allowed");
  const host = url.hostname.toLowerCase();
  if (["localhost", "localhost.localdomain"].includes(host) || host.endsWith(".local")) throw new Error("Local hosts are not allowed");
  if (approvedHosts && !approvedHosts.has(host)) throw new Error(`Host ${host} is not in the approved source allowlist`);
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Private/internal IP addresses are not allowed");
    return url;
  }
  const records = await dns.lookup(host, { all: true, verbatim: true });
  if (!records.length) throw new Error("Host did not resolve");
  if (records.some((record) => isPrivateIp(record.address))) throw new Error("URL resolves to a private/internal address");
  return url;
}

export function redactSecrets(value: string): string {
  return value
    .replace(/(authorization:\s*bearer\s+)[^\s]+/gi, "$1[REDACTED]")
    .replace(/(token|api[_-]?key|secret|password)=([^&\s]+)/gi, "$1=[REDACTED]");
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit = 30, windowMs = 60_000): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);
    return { allowed: true, remaining: limit - 1, resetAt: bucket.resetAt };
  }
  existing.count += 1;
  return { allowed: existing.count <= limit, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt };
}

export function getClientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
