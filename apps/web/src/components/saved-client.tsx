"use client";

import { AnimatePresence, motion } from "motion/react";
import { BellRing, Bookmark, ExternalLink, LoaderCircle, Pause, Play, Plus, Radar, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { springs } from "@/lib/motion";

type Saved = {
  id: string;
  entityType: string;
  entityId: string;
  canonicalUrl: string;
  title: string;
  createdAt: string;
  metadata?: { source?: string };
};

type Watchlist = {
  id: string;
  name: string;
  query: string;
  enabled: boolean;
  createdAt: string;
};

export function SavedClient() {
  const [items, setItems] = useState<Saved[]>([]);
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    const [savedResponse, radarResponse] = await Promise.all([fetch("/api/saved"), fetch("/api/watchlists")]);
    if (savedResponse.status === 401 || radarResponse.status === 401) {
      setAuthenticated(false);
      setLoading(false);
      return;
    }
    const [savedData, radarData] = await Promise.all([savedResponse.json(), radarResponse.json()]);
    setItems(savedData.items ?? []);
    setWatchlists(radarData.watchlists ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  if (loading) {
    return <div className="grid min-h-60 place-items-center"><LoaderCircle className="size-5 animate-spin text-[#45604f]" /></div>;
  }
  if (!authenticated) return <SignedOut />;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[.16em] text-[#748077]">Your opportunity system</div>
          <h1 className="mt-1 text-4xl font-semibold tracking-[-.055em]">Saved + Radar</h1>
          <p className="mt-2 text-sm text-[#6e786f]">Keep a calm shortlist, then let Radar watch for new matches.</p>
        </div>
        <button onClick={() => setShowCreate((value) => !value)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[13px] bg-[#163c2d] px-4 text-sm font-semibold text-white">
          <Plus className="size-4" /> Create Radar
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0, y: -8 }} animate={{ opacity: 1, height: "auto", y: 0 }} exit={{ opacity: 0, height: 0, y: -8 }} transition={springs.snappy} className="overflow-hidden">
            <RadarCreator onCreated={(watchlist) => { setWatchlists((current) => [watchlist, ...current]); setShowCreate(false); }} />
          </motion.div>
        )}
      </AnimatePresence>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold"><Radar className="size-4" /> Opportunity Radar</div>
          <span className="text-xs text-[#78817a]">{watchlists.filter((item) => item.enabled).length} active</span>
        </div>
        {watchlists.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {watchlists.map((watchlist) => (
              <RadarCard
                key={watchlist.id}
                item={watchlist}
                onToggle={async (enabled) => {
                  setWatchlists((current) => current.map((item) => item.id === watchlist.id ? { ...item, enabled } : item));
                  const response = await fetch("/api/watchlists", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: watchlist.id, enabled }) });
                  if (!response.ok) setWatchlists((current) => current.map((item) => item.id === watchlist.id ? { ...item, enabled: !enabled } : item));
                }}
                onDelete={async () => {
                  const previous = watchlists;
                  setWatchlists((current) => current.filter((item) => item.id !== watchlist.id));
                  const response = await fetch("/api/watchlists", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: watchlist.id }) });
                  if (!response.ok) setWatchlists(previous);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-black/10 bg-white/45 p-6 text-sm text-[#718078]">
            Create a Radar such as “beginner React accessibility issues” or “robotics hackathons in Pakistan.” Background workers can match new indexed opportunities to these watches.
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold"><Bookmark className="size-4" /> Shortlist</div>
          <span className="text-xs text-[#78817a]">{items.length} saved</span>
        </div>
        {items.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((item) => (
              <a key={item.id} href={item.canonicalUrl} target="_blank" rel="noreferrer" className="surface group rounded-[22px] p-5 transition hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[.1em] text-[#7b857d]">{item.metadata?.source ?? item.entityType}</div>
                    <h2 className="mt-1.5 font-semibold tracking-[-.025em]">{item.title}</h2>
                  </div>
                  <ExternalLink className="size-4 text-[#849087] transition group-hover:text-[#244f39]" />
                </div>
                <div className="mt-4 text-xs text-[#778079]">Saved {new Date(item.createdAt).toLocaleDateString()}</div>
              </a>
            ))}
          </div>
        ) : (
          <div className="surface rounded-[26px] p-8 text-center">
            <Bookmark className="mx-auto size-6 text-[#78817a]" />
            <h2 className="mt-3 font-semibold">Your shortlist is intentionally empty.</h2>
            <p className="mt-2 text-sm text-[#748077]">Save only opportunities you would genuinely consider working on.</p>
            <Link href="/" className="mt-5 inline-flex rounded-[13px] bg-[#163c2d] px-4 py-2.5 text-sm font-semibold text-white">Discover opportunities</Link>
          </div>
        )}
      </section>
    </div>
  );
}

function RadarCreator({ onCreated }: { onCreated: (watchlist: Watchlist) => void }) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (!name.trim() || !query.trim()) return;
        setBusy(true); setError("");
        try {
          const response = await fetch("/api/watchlists", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, query, filters: {} }) });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Could not create Radar");
          onCreated(data.watchlist);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Could not create Radar");
        } finally { setBusy(false); }
      }}
      className="surface mb-6 grid gap-3 rounded-[24px] p-4 sm:grid-cols-[.75fr_1.4fr_auto]"
    >
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Radar name" className="h-11 rounded-[13px] border border-black/8 bg-[#fafbf8] px-3 text-sm outline-none focus:border-[#8eb9a0]" />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What should KOBI keep watching?" className="h-11 rounded-[13px] border border-black/8 bg-[#fafbf8] px-3 text-sm outline-none focus:border-[#8eb9a0]" />
      <button disabled={busy} className="h-11 rounded-[13px] bg-[#163c2d] px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Creating…" : "Create"}</button>
      {error && <p className="text-xs text-[#a33d32] sm:col-span-3">{error}</p>}
    </form>
  );
}

function RadarCard({ item, onToggle, onDelete }: { item: Watchlist; onToggle: (enabled: boolean) => void; onDelete: () => void }) {
  return (
    <motion.article layout className={`surface rounded-[22px] p-5 ${item.enabled ? "" : "opacity-65"}`}>
      <div className="flex items-start justify-between gap-3">
        <span className={`grid size-10 place-items-center rounded-[13px] ${item.enabled ? "bg-[#e7f4eb] text-[#285b42]" : "bg-black/5 text-[#7b837d]"}`}><BellRing className="size-4" /></span>
        <div className="flex gap-1">
          <button onClick={() => onToggle(!item.enabled)} aria-label={item.enabled ? "Pause Radar" : "Resume Radar"} className="grid size-8 place-items-center rounded-[10px] hover:bg-black/5">{item.enabled ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}</button>
          <button onClick={onDelete} aria-label="Delete Radar" className="grid size-8 place-items-center rounded-[10px] hover:bg-[#fff0ee] hover:text-[#9c3e34]"><Trash2 className="size-3.5" /></button>
        </div>
      </div>
      <h3 className="mt-4 font-semibold tracking-[-.025em]">{item.name}</h3>
      <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-[#687168]">{item.query}</p>
      <div className="mt-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-[.08em] text-[#7e887f]">
        <span>{item.enabled ? "Watching" : "Paused"}</span>
        <Link href={`/?q=${encodeURIComponent(item.query)}`} className="normal-case tracking-normal text-[#315f47]">Run now →</Link>
      </div>
    </motion.article>
  );
}

function SignedOut() {
  return (
    <div className="surface mx-auto max-w-xl rounded-[28px] p-8 text-center">
      <Bookmark className="mx-auto size-6 text-[#5f6b62]" />
      <h1 className="mt-3 text-2xl font-semibold tracking-[-.04em]">Keep your opportunity trail in one place.</h1>
      <p className="mt-3 text-sm leading-6 text-[#6c766e]">Sign in to sync saved projects, issues and events, and create Radars that watch for new matches.</p>
      <Link href="/login" className="mt-5 inline-flex rounded-[13px] bg-[#163c2d] px-5 py-2.5 text-sm font-semibold text-white">Sign in</Link>
    </div>
  );
}
