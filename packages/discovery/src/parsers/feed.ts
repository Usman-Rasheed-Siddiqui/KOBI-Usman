import { XMLParser } from "fast-xml-parser";
import { cleanDisplayText } from "@openforge/domain";

export type ParsedFeedItem = {
  title: string;
  description?: string;
  url: string;
  publishedAt?: string;
  categories: string[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
});

function arrayify<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string | undefined {
  if (typeof value === "string") return cleanDisplayText(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidate = record["#text"] ?? record["@_term"] ?? record["@_label"];
    return typeof candidate === "string" ? cleanDisplayText(candidate) : undefined;
  }
  return undefined;
}

function atomLink(value: unknown): string | undefined {
  for (const item of arrayify(value)) {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const rel = String(record["@_rel"] ?? "alternate");
    const href = record["@_href"];
    if ((rel === "alternate" || rel === "") && typeof href === "string") return href;
  }
  return undefined;
}

export function parseSyndicationFeed(xml: string, sourceUrl: string): ParsedFeedItem[] {
  const parsed = parser.parse(xml) as Record<string, any>;
  const output: ParsedFeedItem[] = [];

  const rssItems = arrayify(parsed?.rss?.channel?.item);
  for (const item of rssItems) {
    const title = text(item?.title);
    const link = text(item?.link) ?? text(item?.guid);
    if (!title || !link) continue;
    let url: string;
    try { url = new URL(link, sourceUrl).toString(); } catch { continue; }
    output.push({
      title,
      description: text(item?.description) ?? text(item?.["content:encoded"]),
      url,
      publishedAt: text(item?.pubDate) ?? text(item?.["dc:date"]),
      categories: arrayify(item?.category).map(text).filter((value): value is string => Boolean(value)),
    });
  }

  const atomEntries = arrayify(parsed?.feed?.entry);
  for (const entry of atomEntries) {
    const title = text(entry?.title);
    const link = atomLink(entry?.link) ?? text(entry?.id);
    if (!title || !link) continue;
    let url: string;
    try { url = new URL(link, sourceUrl).toString(); } catch { continue; }
    output.push({
      title,
      description: text(entry?.summary) ?? text(entry?.content),
      url,
      publishedAt: text(entry?.updated) ?? text(entry?.published),
      categories: arrayify(entry?.category).map(text).filter((value): value is string => Boolean(value)),
    });
  }

  return output;
}
