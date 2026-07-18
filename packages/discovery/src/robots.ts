import { assertSafePublicUrl } from "@openforge/security";

type Rule = { allow: boolean; path: string };
type CacheEntry = { expiresAt: number; rules: Rule[] };
const cache = new Map<string, CacheEntry>();
const USER_AGENT = "kobidiscovery";

function parseRobots(text: string): Rule[] {
  const rules: Rule[] = [];
  let groupApplies = false;
  let seenRule = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      if (seenRule) { groupApplies = false; seenRule = false; }
      const ua = value.toLowerCase();
      groupApplies = groupApplies || ua === "*" || USER_AGENT.includes(ua) || ua.includes(USER_AGENT);
      continue;
    }
    if ((key === "allow" || key === "disallow") && groupApplies) {
      seenRule = true;
      if (value) rules.push({ allow: key === "allow", path: value });
    }
  }
  return rules;
}

export async function isAllowedByRobots(rawUrl: string, approvedHosts?: string[], signal?: AbortSignal): Promise<boolean> {
  const approved = approvedHosts ? new Set(approvedHosts) : undefined;
  const url = await assertSafePublicUrl(rawUrl, approved);
  const origin = url.origin;
  const cached = cache.get(origin);
  let rules = cached?.expiresAt && cached.expiresAt > Date.now() ? cached.rules : undefined;

  if (!rules) {
    try {
      const robotsUrl = await assertSafePublicUrl(`${origin}/robots.txt`, approved);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      const abort = () => controller.abort(signal?.reason);
      signal?.addEventListener("abort", abort, { once: true });
      try {
        const response = await fetch(robotsUrl, { headers: { "user-agent": "KOBIDiscovery/1.0" }, redirect: "manual", signal: controller.signal });
        rules = response.ok ? parseRobots((await response.text()).slice(0, 500_000)) : [];
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      }
    } catch {
      // Fail open only for robots retrieval errors. Source-specific terms and
      // explicit operator allowlists still control whether an adapter exists.
      rules = [];
    }
    cache.set(origin, { rules, expiresAt: Date.now() + 10 * 60_000 });
  }

  const path = `${url.pathname}${url.search}`;
  const matching = rules.filter((rule) => path.startsWith(rule.path)).sort((a, b) => b.path.length - a.path.length);
  return matching[0]?.allow ?? true;
}
