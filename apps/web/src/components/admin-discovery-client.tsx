"use client";

import { Activity, BadgeCheck, ExternalLink, LoaderCircle, Pause, Play, RefreshCw, ShieldAlert, X } from "lucide-react";
import { useEffect, useState } from "react";

type Source = { id: string; name: string; status: string; enabled: boolean; lastCrawlAt?: string; successRate: number; avgLatencyMs: number; itemsDiscovered: number; lastError?: string };
type Claim = { id: string; status: string; evidenceUrl?: string | null; notes?: string | null; user: { name: string; email: string }; project: { title: string; canonicalUrl: string; repository?: { repositoryUrl: string } | null } };

export function AdminDiscoveryClient() {
  const [sources, setSources] = useState<Source[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try {
      const [sourceResponse, claimResponse] = await Promise.all([fetch("/api/admin/sources"), fetch("/api/admin/claims")]);
      const sourceData = await sourceResponse.json(); const claimData = await claimResponse.json();
      if (!sourceResponse.ok) throw new Error(sourceData.error ?? "Admin access required");
      setSources(sourceData.sources ?? []); setClaims(claimResponse.ok ? claimData.claims ?? [] : []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Admin console unavailable"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const act = async (sourceId: string, action: "pause" | "resume" | "test") => {
    const response = await fetch("/api/admin/sources", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceId, action }) });
    const data = await response.json();
    if (action === "test") window.alert(data.health ? `${data.health.ok ? "Healthy" : "Degraded"} · ${data.health.latencyMs}ms` : data.error);
    await load();
  };
  const review = async (claimId: string, status: "VERIFIED" | "REJECTED") => {
    await fetch("/api/admin/claims", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ claimId, status }) });
    await load();
  };

  if (loading) return <div className="grid h-64 place-items-center"><LoaderCircle className="size-5 animate-spin" /></div>;
  if (error) return <div className="surface rounded-[24px] p-8"><h1 className="text-xl font-semibold">Discovery console unavailable</h1><p className="mt-2 text-sm text-[#6f796f]">{error}</p></div>;

  return <div className="space-y-8">
    <div><div className="text-[11px] font-bold uppercase tracking-[.16em] text-[#748077]">Internal observability</div><h1 className="mt-1 text-3xl font-semibold tracking-[-.05em]">Discovery console</h1></div>
    <section><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">Source health</h2><button onClick={() => void load()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#667168]"><RefreshCw className="size-3.5" />Refresh</button></div><div className="overflow-hidden rounded-[24px] border border-black/7 bg-white"><div className="hidden grid-cols-[1.3fr_.7fr_.8fr_.8fr_1fr] gap-3 border-b border-black/7 bg-[#f7f8f5] px-5 py-3 text-[10px] font-bold uppercase tracking-[.1em] text-[#78827a] md:grid"><span>Source</span><span>Status</span><span>Latency</span><span>Discovered</span><span>Controls</span></div>{sources.map((source) => <div key={source.id} className="grid gap-3 border-b border-black/7 px-5 py-4 last:border-0 md:grid-cols-[1.3fr_.7fr_.8fr_.8fr_1fr] md:items-center"><div><div className="font-semibold">{source.name}</div>{source.lastError && <div className="mt-1 line-clamp-1 text-[10px] text-[#a04b36]">{source.lastError}</div>}</div><div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${source.status === "ACTIVE" ? "bg-[#e8f5ec] text-[#286246]" : "bg-[#f5eee8] text-[#7c563b]"}`}>{source.status}</span></div><div className="text-sm text-[#657067]">{source.avgLatencyMs}ms</div><div className="text-sm text-[#657067]">{source.itemsDiscovered}</div><div className="flex gap-1"><button aria-label={source.enabled ? "Pause source" : "Resume source"} onClick={() => void act(source.id, source.enabled ? "pause" : "resume")} className="grid size-9 place-items-center rounded-xl border border-black/7 hover:bg-[#f5f6f3]">{source.enabled ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}</button><button aria-label="Test source" onClick={() => void act(source.id, "test")} className="grid size-9 place-items-center rounded-xl border border-black/7 hover:bg-[#f5f6f3]"><Activity className="size-3.5" /></button></div></div>)}</div></section>

    <section><div className="mb-3"><div className="text-[11px] font-bold uppercase tracking-[.13em] text-[#748077]">Trust & stewardship</div><h2 className="mt-1 text-xl font-semibold tracking-[-.04em]">Maintainer claims</h2></div><div className="grid gap-3 lg:grid-cols-2">{claims.length ? claims.map((claim) => <article key={claim.id} className="surface rounded-[22px] p-5"><div className="flex items-start justify-between gap-4"><div><div className="text-sm font-semibold">{claim.project.title}</div><div className="mt-1 text-[11px] text-[#758078]">{claim.user.name} · {claim.user.email}</div></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${claim.status === "VERIFIED" ? "bg-[#e7f4ea] text-[#2c6548]" : claim.status === "REJECTED" ? "bg-[#f7ece6] text-[#8a5135]" : "bg-[#faf5dd] text-[#75652f]"}`}>{claim.status}</span></div><div className="mt-3 flex flex-wrap gap-2"><a href={claim.project.repository?.repositoryUrl ?? claim.project.canonicalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-[10px] border border-black/8 px-2.5 py-2 text-[11px] font-semibold">Repository <ExternalLink className="size-3" /></a>{claim.evidenceUrl && <a href={claim.evidenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-[10px] border border-black/8 px-2.5 py-2 text-[11px] font-semibold">Evidence <ExternalLink className="size-3" /></a>}</div>{claim.status === "PENDING" && <div className="mt-4 flex gap-2"><button onClick={() => void review(claim.id, "VERIFIED")} className="inline-flex items-center gap-1.5 rounded-[11px] bg-[#dff1e5] px-3 py-2 text-[11px] font-semibold text-[#28573f]"><BadgeCheck className="size-3.5" />Verify</button><button onClick={() => void review(claim.id, "REJECTED")} className="inline-flex items-center gap-1.5 rounded-[11px] bg-[#f5ece7] px-3 py-2 text-[11px] font-semibold text-[#835038]"><X className="size-3.5" />Reject</button></div>}{claim.notes && <p className="mt-3 text-[11px] leading-5 text-[#6c756e]">{claim.notes}</p>}</article>) : <div className="col-span-full flex items-center gap-3 rounded-[20px] border border-black/7 bg-white p-5 text-sm text-[#6b756d]"><ShieldAlert className="size-5" />No maintainer claims yet.</div>}</div></section>
  </div>;
}
