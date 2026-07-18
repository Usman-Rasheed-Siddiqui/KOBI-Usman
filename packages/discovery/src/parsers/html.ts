import * as cheerio from "cheerio";
import { cleanDescription, cleanDisplayText } from "@openforge/domain";

export type ParsedEvent = {
  title: string;
  description?: string;
  url: string;
  registrationUrl?: string;
  startsAt?: string;
  endsAt?: string;
  location?: string;
  mode?: "REMOTE" | "PHYSICAL" | "HYBRID" | "UNKNOWN";
  image?: string;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" ? cleanDisplayText(value) : undefined;
}

export function extractJsonLdEvents(html: string, pageUrl: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const results: ParsedEvent[] = [];
  $("script[type='application/ld+json']").each((_, node) => {
    try {
      const raw = $(node).text();
      const parsed = JSON.parse(raw) as unknown;
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length) {
        const value = queue.shift();
        if (!value || typeof value !== "object") continue;
        const record = value as Record<string, unknown>;
        if (Array.isArray(record["@graph"])) queue.push(...(record["@graph"] as unknown[]));
        const type = record["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (!types.includes("Event")) continue;
        const title = asText(record.name);
        if (!title) continue;
        const locationValue = record.location;
        let location: string | undefined;
        if (typeof locationValue === "string") location = cleanDisplayText(locationValue);
        if (locationValue && typeof locationValue === "object") {
          const loc = locationValue as Record<string, unknown>;
          const address = loc.address;
          if (typeof address === "string") location = cleanDisplayText(address);
          if (address && typeof address === "object") {
            const a = address as Record<string, unknown>;
            location = cleanDisplayText([a.addressLocality, a.addressRegion, a.addressCountry].filter((x): x is string => typeof x === "string").join(", "));
          }
        }
        const attendance = asString(record.eventAttendanceMode)?.toLowerCase() ?? "";
        const mode = attendance.includes("mixed") ? "HYBRID" : attendance.includes("online") ? "REMOTE" : attendance ? "PHYSICAL" : "UNKNOWN";
        results.push({
          title,
          description: cleanDescription(asString(record.description), title),
          url: asString(record.url) ? new URL(asString(record.url)!, pageUrl).toString() : pageUrl,
          registrationUrl: asString(record.url),
          startsAt: asString(record.startDate),
          endsAt: asString(record.endDate),
          location,
          mode,
          image: asString(record.image)
        });
      }
    } catch {
      // Ignore malformed publisher JSON-LD; adapter remains isolated.
    }
  });
  return results;
}
