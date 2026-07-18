"use client";

import type { Opportunity } from "@openforge/domain";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CalendarDays, DatabaseZap, Filter, GitPullRequest, Loader2, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OpportunityCard } from "./opportunity-card";
import { SearchResultsSkeleton } from "./skeletons";
import { Button, GhostButton } from "./ui";
import { springs } from "@/lib/motion";

type Kind = "pulse" | "forge";
type Facet = { value: string; count: number };
type LibraryResponse = {
  items: Opportunity[];
  nextCursor: string | null;
  facets: Record<string, Facet[]>;
  error?: string;
};

type LibraryFilters = {
  q: string;
  genre: string;
  timeframe: string;
  mode: string;
  eventType: string;
  location: string;
  language: string;
  difficulty: string;
  label: string;
  freshnessDays: string;
  includeProjects: boolean;
};

const defaultFilters = (kind: Kind): LibraryFilters => ({
  q: "",
  genre: "",
  timeframe: kind === "pulse" ? "upcoming" : "",
  mode: "",
  eventType: "",
  location: "",
  language: "",
  difficulty: "",
  label: "",
  freshnessDays: kind === "forge" ? "180" : "",
  includeProjects: true,
});

export function DiscoveryLibrary({ kind }: { kind: Kind }) {
  const [filters, setFilters] = useState(() => defaultFilters(kind));
  const [items, setItems] = useState<Opportunity[]>([]);
  const [facets, setFacets] = useState<Record<string, Facet[]>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const endpoint = kind === "pulse" ? "/api/pulse/library" : "/api/forge/library";
  const copy = kind === "pulse"
    ? {
      title: "KOBI Pulse Collection",
      input: "Search saved events",
      emptyTitle: "No saved events match this view",
      emptyText: "Use Discover or KOBI Agent to uncover current events. Valid results are saved here automatically.",
      count: "saved events found through KOBI",
      discover: "Discover fresh events",
    }
    : {
      title: "KOBI Forge Collection",
      input: "Search saved opportunities",
      emptyTitle: "No saved opportunities match this view",
      emptyText: "Use Discover or KOBI Agent to find active repositories and issues. Valid results are saved here automatically.",
      count: "saved opportunities found through KOBI",
      discover: "Discover fresh opportunities",
    };

  const params = useMemo(() => {
    const next = new URLSearchParams({ limit: "18" });
    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === "boolean") next.set(key, String(value));
      else if (value.trim()) next.set(key, value.trim());
    }
    return next;
  }, [filters]);

  async function load(cursor?: string) {
    setError("");
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    try {
      const nextParams = new URLSearchParams(params);
      if (cursor) nextParams.set("cursor", cursor);
      const response = await fetch(`${endpoint}?${nextParams}`, { cache: "no-store" });
      const data = await response.json() as LibraryResponse;
      if (!response.ok || data.error) throw new Error(data.error || "Saved discoveries could not be loaded.");
      setFacets(data.facets ?? {});
      setNextCursor(data.nextCursor ?? null);
      setItems((current) => cursor ? dedupe([...current, ...(data.items ?? [])]) : data.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Saved discoveries could not be loaded.");
      if (!cursor) setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 180);
    return () => window.clearTimeout(timer);
  }, [params.toString()]);

  const set = (patch: Partial<LibraryFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const reset = () => setFilters(defaultFilters(kind));
  const discoverHref = `/${kind}?q=${encodeURIComponent(filters.q || (kind === "pulse" ? "upcoming developer events" : "beginner friendly open source contributions"))}`;

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.15em] text-[#728076]">
            <DatabaseZap className="size-3.5" />Discovered with KOBI
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-.045em]">{copy.title}</h2>
          <p className="mt-1 text-sm leading-6 text-[#687168]">
            {loading ? "Checking saved discoveries" : `${items.length}${nextCursor ? "+" : ""} ${copy.count}`}
          </p>
        </div>
        <Link href={discoverHref} className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-[13px] bg-[#163c2d] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d503b]">
          {copy.discover}<ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="glass rounded-[22px] p-2">
        <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_auto]">
          <label className="flex h-12 items-center gap-2 rounded-[16px] bg-white px-3">
            <Search className="size-4 text-[#728076]" />
            <input value={filters.q} onChange={(event) => set({ q: event.target.value })} placeholder={copy.input} className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#8b948c]" />
          </label>
          <GhostButton onClick={reset} className="h-12 rounded-[16px]">
            <SlidersHorizontal className="size-4" />Reset filters
          </GhostButton>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <Select label="Genre" value={filters.genre} onChange={(value) => set({ genre: value })} options={facets.genres ?? []} />
          {kind === "pulse" ? (
            <>
              <Select label="Timeframe" value={filters.timeframe} onChange={(value) => set({ timeframe: value })} options={[
                { value: "upcoming", count: 0 }, { value: "week", count: 0 }, { value: "month", count: 0 }, { value: "all", count: 0 }, { value: "historical", count: 0 },
              ]} labelFor={(value) => value === "week" ? "This week" : value === "month" ? "This month" : value.charAt(0).toUpperCase() + value.slice(1)} />
              <Select label="Mode" value={filters.mode} onChange={(value) => set({ mode: value })} options={facets.modes ?? []} labelFor={(value) => value === "REMOTE" ? "Online" : value === "PHYSICAL" ? "In person" : value.charAt(0) + value.slice(1).toLowerCase()} />
              <Select label="Type" value={filters.eventType} onChange={(value) => set({ eventType: value })} options={facets.eventTypes ?? []} />
              <label className="flex h-11 items-center gap-2 rounded-[15px] bg-white px-3">
                <Filter className="size-4 text-[#728076]" />
                <input value={filters.location} onChange={(event) => set({ location: event.target.value })} placeholder="City or country" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              </label>
            </>
          ) : (
            <>
              <Select label="Language" value={filters.language} onChange={(value) => set({ language: value })} options={facets.languages ?? []} />
              <Select label="Difficulty" value={filters.difficulty} onChange={(value) => set({ difficulty: value })} options={facets.difficulties ?? []} />
              <Select label="Label" value={filters.label} onChange={(value) => set({ label: value })} options={facets.labels ?? []} labelFor={(value) => value.replaceAll("-", " ")} />
              <Select label="Freshness" value={filters.freshnessDays} onChange={(value) => set({ freshnessDays: value })} options={[{ value: "7", count: 0 }, { value: "30", count: 0 }, { value: "90", count: 0 }, { value: "180", count: 0 }, { value: "365", count: 0 }]} labelFor={(value) => value === "7" ? "This week" : value === "30" ? "This month" : `${value} days`} />
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-[18px] border border-[#f0c1bd] bg-[#fff3f1] p-4 text-sm text-[#8a2b22]">{error}</div>
      )}

      <div className="mt-6">
        {loading ? (
          <SearchResultsSkeleton count={6} />
        ) : items.length ? (
          <>
            <AnimatePresence mode="popLayout">
              <motion.div layout className="grid gap-3 lg:grid-cols-2">
                {items.map((item) => (
                  <motion.div layout key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: .985 }} transition={springs.snappy}>
                    <OpportunityCard item={item} />
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
            {nextCursor && (
              <div className="mt-6 flex justify-center">
                <Button onClick={() => void load(nextCursor)} disabled={loadingMore} className="min-w-40">
                  {loadingMore ? <Loader2 className="size-4 animate-spin" /> : null}Load more
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyLibrary kind={kind} title={copy.emptyTitle} text={copy.emptyText} href={discoverHref} />
        )}
      </div>
    </section>
  );
}

function Select({ label, value, onChange, options, labelFor }: { label: string; value: string; onChange: (value: string) => void; options: Facet[]; labelFor?: (value: string) => string }) {
  return (
    <label className="grid gap-1 rounded-[15px] bg-white px-3 py-2">
      <span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#7b867d]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-6 min-w-0 bg-transparent text-sm font-medium outline-none">
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {labelFor ? labelFor(option.value) : option.value}{option.count ? ` (${option.count})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyLibrary({ kind, title, text, href }: { kind: Kind; title: string; text: string; href: string }) {
  const Icon = kind === "pulse" ? CalendarDays : GitPullRequest;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface mx-auto max-w-2xl rounded-[26px] p-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-[16px] bg-[#edf3ed] text-[#315b43]"><Icon className="size-5" /></span>
      <h3 className="mt-4 text-lg font-semibold tracking-[-.03em]">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#687168]">{text}</p>
      <Link href={href} className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-[13px] bg-[#163c2d] px-4 text-sm font-semibold text-white">
        Open Discover<ArrowRight className="size-4" />
      </Link>
    </motion.div>
  );
}

function dedupe(items: Opportunity[]) {
  const map = new Map<string, Opportunity>();
  for (const item of items) {
    const previous = map.get(item.canonicalUrl);
    if (!previous || item.qualityScore > previous.qualityScore) map.set(item.canonicalUrl, item);
  }
  return [...map.values()];
}
