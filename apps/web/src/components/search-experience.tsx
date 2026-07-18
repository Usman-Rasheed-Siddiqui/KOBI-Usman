"use client";

import type { Opportunity } from "@openforge/domain";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Bot, CalendarDays, GitPullRequest, Search, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { OpportunityCard } from "./opportunity-card";
import { SearchResultsSkeleton } from "./skeletons";
import { emptySearchFilters, FilterBar, type DiscoveryVariant, type SearchFilters } from "./filter-bar";
import { SourceProgress, type SourceState } from "./source-progress";
import { springs } from "@/lib/motion";

type SearchMode = "all" | "forge" | "pulse" | "contributions" | "projects" | "hardware" | "events";

const defaultExamples = ["Beginner React accessibility issues", "Upcoming AI hackathons", "Python projects needing documentation"];

const exampleByMode: Record<DiscoveryVariant, string[]> = {
  pulse: ["Upcoming AI events in Pakistan", "Online developer events this week", "AI hackathons next month", "Developer events in Europe"],
  forge: ["Beginner-friendly React contributions", "TypeScript good first issues updated recently", "Open-source AI projects looking for contributors", "Python documentation issues"],
  hardware: ["Open-source ESP32 robotics", "Arduino help wanted issues", "KiCad hardware projects"],
  projects: ["Active open-source AI projects", "React libraries seeking contributors", "Python tools needing docs"],
  all: defaultExamples,
};

function variantFor(mode: SearchMode): DiscoveryVariant {
  if (mode === "pulse" || mode === "events") return "pulse";
  if (mode === "forge" || mode === "contributions") return "forge";
  if (mode === "hardware") return "hardware";
  if (mode === "projects") return "projects";
  return "all";
}

export function SearchExperience({ initialQuery = "", mode = "all" }: { initialQuery?: string; mode?: SearchMode }) {
  const variant = variantFor(mode);
  const [q, setQ] = useState(initialQuery);
  const [submitted, setSubmitted] = useState(initialQuery);
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(Boolean(initialQuery));
  const [complete, setComplete] = useState(false);
  const [sources, setSources] = useState<SourceState[]>([]);
  const [filters, setFilters] = useState<SearchFilters>(() => emptySearchFilters(variant));
  const eventRef = useRef<EventSource | null>(null);

  const copy = variant === "pulse"
    ? {
      title: "Search KOBI Pulse",
      placeholder: "Try AI hackathons in Pakistan next month",
      eyebrow: "Event discovery",
      empty: "No current events matched every filter",
      ask: "Ask KOBI Agent about these events",
    }
    : variant === "forge"
      ? {
        title: "Search KOBI Forge",
        placeholder: "Try beginner React contributions updated recently",
        eyebrow: "Contribution discovery",
        empty: "No active contributions matched every filter",
        ask: "Ask KOBI Agent to compare these",
      }
      : {
        title: "Discover with KOBI",
        placeholder: "What do you want to build, contribute to, or learn?",
        eyebrow: "Active web discovery",
        empty: "No strong matches yet",
        ask: "Ask KOBI Agent to rank these",
      };

  const search = (query = q, overrideFilters?: SearchFilters) => {
    const clean = query.trim();
    if (!clean) return;
    const activeFilters = overrideFilters ?? filters;

    eventRef.current?.close();
    setSubmitted(clean);
    setLoading(true);
    setComplete(false);
    setItems([]);
    setSources([{ name: "KOBI Index", status: "searching" }]);

    const params = new URLSearchParams({
      q: clean,
      mode: variant === "pulse" ? "pulse" : variant === "forge" || variant === "hardware" || variant === "projects" ? "forge" : mode,
      fast: String(activeFilters.fast),
      hard: String(activeFilters.hard),
      beginner: String(activeFilters.beginner),
      hardware: String(activeFilters.hardware),
      hiddenGems: String(activeFilters.hiddenGems),
      smallScope: String(activeFilters.smallScope),
      goodFirstIssue: String(activeFilters.goodFirstIssue),
      helpWanted: String(activeFilters.helpWanted),
      remote: String(activeFilters.remote || activeFilters.eventMode === "REMOTE"),
      difficulty: activeFilters.difficulty.join(","),
      updatedWithinDays: activeFilters.updatedWithinDays ? String(activeFilters.updatedWithinDays) : "",
      source: activeFilters.source ?? "",
      location: activeFilters.location.trim(),
      datePreset: activeFilters.datePreset ?? "",
      eventMode: activeFilters.eventMode || "",
      eventType: activeFilters.eventType ?? "",
      includeProjects: String(activeFilters.includeProjects),
      issueStatus: "open",
    });

    const es = new EventSource(`/api/search/stream?${params}`);
    eventRef.current = es;
    es.onmessage = (eventMessage) => {
      const event = JSON.parse(eventMessage.data) as Record<string, any>;
      if (event.type === "source_started") {
        setSources((current) => [
          ...current.filter((source) => source.name !== event.source),
          { name: event.source, status: "searching" },
        ]);
      }
      if (event.type === "source_result") {
        setItems((previous) => dedupe([...previous, ...(event.items ?? [])]));
        setSources((current) => current.map((source) => source.name === event.source ? { ...source, count: event.count } : source));
      }
      if (event.type === "source_complete") {
        setSources((current) => current.map((source) => source.name === event.source ? { ...source, status: "complete", count: event.count, latency: event.latencyMs } : source));
      }
      if (event.type === "source_failed") {
        setSources((current) => {
          const exists = current.some((source) => source.name === event.source);
          if (!exists) return [...current, { name: event.source, status: "failed" }];
          return current.map((source) => source.name === event.source ? { ...source, status: "failed" } : source);
        });
      }
      if (event.type === "ranking_update") setItems(event.items ?? []);
      if (event.type === "session_complete") {
        setLoading(false);
        setComplete(true);
        es.close();
      }
    };
    es.onerror = () => {
      setLoading(false);
      setComplete(true);
      es.close();
    };
  };

  useEffect(() => () => eventRef.current?.close(), []);
  useEffect(() => {
    if (initialQuery) search(initialQuery);
  }, []);

  const visible = useMemo(() => items.filter((item) => {
    if (variant === "pulse") return item.entityType === "EVENT";
    if (variant === "forge") return item.entityType !== "EVENT";
    if (variant === "hardware") return item.hardware;
    if (variant === "projects") return item.entityType === "PROJECT" || item.entityType === "HARDWARE_PROJECT";
    return true;
  }), [items, variant]);

  const headline = loading && !visible.length
    ? filters.hard ? "Checking saved discoveries, then preparing deeper discovery" : filters.fast ? "Checking saved discoveries, then the fastest sources" : "Checking saved discoveries, then searching sources"
    : visible.length
      ? `${visible.length} ${variant === "pulse" ? "current events" : variant === "forge" ? "active opportunities" : "strong matches"}`
      : copy.empty;

  const examples = exampleByMode[variant];

  return (
    <div>
      <div className="mx-auto max-w-5xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[.15em] text-[#728076]">{copy.eyebrow}</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-.045em]">{copy.title}</h2>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-[#b9d9c4] bg-[#e8f5ec] px-3 py-1.5 text-[11px] font-semibold text-[#275f43] sm:inline-flex">
            <Zap className="size-3.5" />{filters.hard ? "Hard Search" : filters.fast ? "Fast Mode" : "Normal Mode"}
          </span>
        </div>

        <div className="glass rounded-[24px] p-2 shadow-[0_22px_80px_rgba(35,65,47,.10)]">
          <form onSubmit={(event) => { event.preventDefault(); search(); }} className="flex items-center gap-2">
            <span className="grid size-11 shrink-0 place-items-center text-[#526057]"><Search className="size-5" /></span>
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              className="h-12 min-w-0 flex-1 bg-transparent text-[16px] font-medium tracking-[-.015em] outline-none placeholder:text-[#8b948c] sm:text-[17px]"
              placeholder={copy.placeholder}
              aria-label={copy.title}
            />
            <motion.button whileTap={{ scale: .96 }} transition={springs.snappy} className="grid size-11 shrink-0 place-items-center rounded-[15px] bg-[#163c2d] text-white shadow-sm" aria-label="Search">
              <ArrowRight className="size-4.5" />
            </motion.button>
          </form>
        </div>

        <div className="mt-3">
          <FilterBar variant={filterVariant(variant, visible)} value={filters} onChange={(next) => { setFilters(next); if (submitted) search(submitted, next); }} />
        </div>

        {!submitted && (
          <div className="mt-4 flex flex-wrap gap-2">
            {examples.map((example) => (
              <button key={example} onClick={() => { setQ(example); search(example); }} className="focus-ring rounded-full border border-black/7 bg-white/60 px-3 py-2 text-xs text-[#677169] transition hover:bg-white">
                {example}
              </button>
            ))}
          </div>
        )}
        <SourceProgress sources={sources} show={loading || sources.length > 0} />
      </div>

      <div className="mt-7">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            {submitted && (
              <>
                <div className="text-[11px] font-bold uppercase tracking-[.15em] text-[#728076]">{filters.hard ? "Hard Search" : filters.fast ? "Fast discovery" : "Normal discovery"}</div>
                <h2 className="mt-1 text-xl font-semibold tracking-[-.04em] sm:text-2xl">{headline}</h2>
              </>
            )}
          </div>
          {visible.length > 0 && (
            <a href={`/agent?q=${encodeURIComponent(submitted)}`} className="hidden items-center gap-2 rounded-xl border border-black/7 bg-white/65 px-3 py-2 text-xs font-semibold sm:flex">
              <Bot className="size-3.5" /> {copy.ask}
            </a>
          )}
        </div>

        {loading && !visible.length ? (
          <SearchResultsSkeleton count={filters.hard ? 8 : filters.fast ? 4 : 6} />
        ) : (
          <AnimatePresence mode="popLayout">
            {visible.length ? (
              <ResultGrid items={visible} universal={variant === "all"} />
            ) : complete && submitted ? (
              <EmptyState query={submitted} variant={variant} onBroaden={() => {
                const broad = {
                  ...filters,
                  fast: false,
                  hard: true,
                  source: undefined,
                };
                setFilters(broad);
                search(submitted, broad);
              }} />
            ) : null}
          </AnimatePresence>
        )}
      </div>
    </div>
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

function filterVariant(base: DiscoveryVariant, items: Opportunity[]): DiscoveryVariant {
  if (base !== "all" || !items.length) return base;
  const hasEvents = items.some((item) => item.entityType === "EVENT");
  const hasForge = items.some((item) => item.entityType !== "EVENT");
  if (hasEvents && !hasForge) return "pulse";
  if (hasForge && !hasEvents) return "forge";
  return "all";
}

function ResultGrid({ items, universal }: { items: Opportunity[]; universal: boolean }) {
  const events = items.filter((item) => item.entityType === "EVENT");
  const forge = items.filter((item) => item.entityType !== "EVENT");
  if (!universal || !events.length || !forge.length) {
    return <CardGrid items={items} />;
  }
  return (
    <div className="space-y-8">
      <ResultSection title="KOBI Pulse results" text="Events stayed in their own lane." items={events} />
      <ResultSection title="KOBI Forge results" text="Contribution opportunities are separated from events." items={forge} />
    </div>
  );
}

function ResultSection({ title, text, items }: { title: string; text: string; items: Opportunity[] }) {
  return (
    <section>
      <div className="mb-3">
        <div className="text-[11px] font-bold uppercase tracking-[.15em] text-[#728076]">{title}</div>
        <p className="mt-1 text-sm text-[#687168]">{text}</p>
      </div>
      <CardGrid items={items} />
    </section>
  );
}

function CardGrid({ items }: { items: Opportunity[] }) {
  return (
    <motion.div layout className="grid gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <motion.div layout key={item.id} initial={{ opacity: 0, y: 12, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: .98 }} transition={springs.snappy}>
          <OpportunityCard item={item} />
        </motion.div>
      ))}
    </motion.div>
  );
}

function EmptyState({ query, variant, onBroaden }: { query: string; variant: DiscoveryVariant; onBroaden: () => void }) {
  const isPulse = variant === "pulse";
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface mx-auto max-w-2xl rounded-[28px] p-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-[16px] bg-[#edf3ed] text-[#315b43]">{isPulse ? <CalendarDays className="size-5" /> : <GitPullRequest className="size-5" />}</span>
      <h3 className="mt-4 text-lg font-semibold tracking-[-.03em]">{isPulse ? "No current events matched" : "No active opportunities matched"}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#687168]">
        KOBI did not find a confident match for &quot;{query}&quot; with every active filter. Try Hard Search, broaden the location or technology, or remove one strict filter.
      </p>
      <button onClick={onBroaden} className="mt-5 rounded-[13px] bg-[#163c2d] px-4 py-2.5 text-sm font-semibold text-white">Broaden and search deeper</button>
    </motion.div>
  );
}
