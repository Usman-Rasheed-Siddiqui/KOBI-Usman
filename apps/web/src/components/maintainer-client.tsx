"use client";

import { motion } from "motion/react";
import { Activity, BadgeCheck, CircleAlert, ExternalLink, GitBranch, LoaderCircle, RefreshCcw, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { springs } from "@/lib/motion";

const defaultSignals = ["Recommended First Issue", "Mentor Available", "Needs Designer", "Needs Documentation", "Needs Hardware Tester", "Needs Firmware", "Needs Researcher"];

type Claim = { id: string; status: "PENDING" | "VERIFIED" | "REJECTED"; evidenceUrl?: string | null; notes?: string | null; project: { id: string; title: string; canonicalUrl: string; repository?: { repositoryUrl: string } | null } };
type Project = { id: string; title: string; canonicalUrl: string; description?: string | null; activityScore: number; qualityScore: number; beginnerScore: number; communityScore: number; metadata?: Record<string, unknown> | null; repository?: { repositoryUrl: string } | null; opportunities: Array<{ id: string; title: string; canonicalUrl: string; beginnerFriendly: boolean; goodFirstIssue: boolean; lastActivity?: string | null }>; roleSlots: Array<{ id: string; title: string; slots: number }>; members: Array<{ id: string }> };

export function MaintainerClient() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [signals, setSignals] = useState<string[]>(defaultSignals);
  const [loading, setLoading] = useState(true);
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/maintainers");
      const data = await response.json();
      if (!response.ok) { setStatus(data.error ?? "Sign in to use maintainer mode."); return; }
      setClaims(data.claims ?? []); setProjects(data.projects ?? []); setSignals(data.signals ?? defaultSignals);
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const claim = async (event: React.FormEvent) => {
    event.preventDefault(); if (!repositoryUrl.trim() || busy) return;
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/maintainers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "claim", repositoryUrl, evidenceUrl: evidenceUrl.trim() || undefined }) });
      const data = await response.json();
      if (!response.ok) { setStatus(data.error ?? "Could not submit claim."); return; }
      setStatus(data.autoVerified ? "Repository permission verified through your connected GitHub account. Maintainer mode is active." : "Claim submitted. GitHub claims can auto-verify when your connected account has maintain/push permission; other claims remain pending for review.");
      setRepositoryUrl(""); setEvidenceUrl(""); await load();
    } finally { setBusy(false); }
  };

  if (loading) return <MaintainerSkeleton />;

  return <div className="space-y-6">
    <section className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <div className="surface rounded-[28px] p-5 sm:p-7">
        <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-[#2f694b]" />Claim a project you maintain</div>
        <p className="mt-2 max-w-2xl text-xs leading-5 text-[#687269]">Connect real maintainers to the projects contributors discover. GitHub repositories can be permission-verified from your connected OAuth account. GitLab/Codeberg or unsupported ownership paths stay pending for review instead of pretending to be verified.</p>
        <form onSubmit={claim} className="mt-5 grid gap-3">
          <label><span className="text-[11px] font-bold uppercase tracking-[.1em] text-[#7b857d]">Repository URL</span><input required value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} placeholder="https://github.com/owner/repository" className="mt-2 h-12 w-full rounded-[14px] border border-black/8 bg-[#fafbf8] px-4 text-sm outline-none focus:border-[#8db79d]" /></label>
          <label><span className="text-[11px] font-bold uppercase tracking-[.1em] text-[#7b857d]">Optional public evidence</span><input value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="Maintainer profile, project page, or public evidence URL" className="mt-2 h-12 w-full rounded-[14px] border border-black/8 bg-[#fafbf8] px-4 text-sm outline-none focus:border-[#8db79d]" /></label>
          <div className="flex items-center justify-between gap-3"><div className="min-h-5 text-xs leading-5 text-[#587060]">{status}</div><motion.button whileTap={{ scale: .97 }} disabled={busy} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[13px] bg-[#163c2d] px-4 text-xs font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <BadgeCheck className="size-3.5" />}Verify / request claim</motion.button></div>
        </form>
      </div>
      <div className="rounded-[28px] border border-[#bedac6] bg-[#eaf5ed] p-5 sm:p-7">
        <div className="text-[11px] font-bold uppercase tracking-[.13em] text-[#4c735d]">Maintainer loop</div>
        <h2 className="mt-2 text-xl font-semibold tracking-[-.04em] text-[#214b36]">Turn “where do I start?” into a clear answer.</h2>
        <div className="mt-5 space-y-3 text-xs text-[#4e6958]">{["Highlight genuine first issues and mentor availability","Advertise missing skills without rebuilding GitHub project management","See contribution clarity, activity and community signals in one place","Route contributors to the real repository and contribution workflow"].map((item) => <div key={item} className="flex gap-2"><Sparkles className="mt-0.5 size-3.5 shrink-0" />{item}</div>)}</div>
      </div>
    </section>

    {claims.length > 0 && <section><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold tracking-[-.03em]">Your claims</h2><button onClick={() => void load()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#607067]"><RefreshCcw className="size-3.5" />Refresh</button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{claims.map((claim) => <ClaimCard key={claim.id} claim={claim} />)}</div></section>}

    <section>
      <div className="mb-3"><div className="text-[11px] font-bold uppercase tracking-[.13em] text-[#748078]">Verified workspaces</div><h2 className="mt-1 text-xl font-semibold tracking-[-.04em]">Projects you can shape for contributors</h2></div>
      {projects.length ? <div className="grid gap-4 xl:grid-cols-2">{projects.map((project) => <MaintainerProject key={project.id} project={project} signals={signals} onChanged={load} />)}</div> : <div className="surface rounded-[24px] p-8 text-center"><ShieldCheck className="mx-auto size-7 text-[#6a786e]" /><div className="mt-3 text-sm font-semibold">No verified maintainer projects yet.</div><p className="mt-1 text-xs text-[#758078]">Submit a repository above or create an KOBI Project Room you own.</p></div>}
    </section>
  </div>;
}

function ClaimCard({ claim }: { claim: Claim }) {
  const tone = claim.status === "VERIFIED" ? "border-[#add2b8] bg-[#edf8f0]" : claim.status === "REJECTED" ? "border-[#dfc4b4] bg-[#fbf2ed]" : "border-[#ded7b6] bg-[#faf8eb]";
  return <motion.div layout className={`rounded-[20px] border p-4 ${tone}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-semibold">{claim.project.title}</div><a href={claim.project.repository?.repositoryUrl ?? claim.project.canonicalUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#657168]">Open repository <ExternalLink className="size-3" /></a></div><span className="rounded-full bg-white/75 px-2.5 py-1 text-[9px] font-bold tracking-[.08em]">{claim.status}</span></div>{claim.notes && <p className="mt-3 text-[11px] leading-5 text-[#667068]">{claim.notes}</p>}</motion.div>;
}

function MaintainerProject({ project, signals, onChanged }: { project: Project; signals: string[]; onChanged: () => Promise<void> }) {
  const metadata = project.metadata && typeof project.metadata === "object" ? project.metadata : {};
  const initial = Array.isArray(metadata.maintainerSignals) ? metadata.maintainerSignals.filter((value): value is string => typeof value === "string") : [];
  const [selected, setSelected] = useState<string[]>(initial);
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { await fetch("/api/maintainers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "signals", projectId: project.id, signals: selected }) }); await onChanged(); } finally { setSaving(false); } };
  return <motion.article layout transition={springs.snappy} className="surface rounded-[26px] p-5 sm:p-6">
    <div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2"><GitBranch className="size-4 text-[#315f47]" /><h3 className="truncate font-semibold tracking-[-.02em]">{project.title}</h3></div><a href={project.repository?.repositoryUrl ?? project.canonicalUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#758078]">Real source <ExternalLink className="size-3" /></a></div><a href={`/project/${project.id}`} className="rounded-[11px] border border-black/8 bg-white px-3 py-2 text-[11px] font-semibold">Open workspace</a></div>
    <div className="mt-5 grid grid-cols-4 gap-2">{[["Activity", project.activityScore, Activity], ["Quality", project.qualityScore, BadgeCheck], ["Beginner", project.beginnerScore, Sparkles], ["Community", project.communityScore, Users]].map(([label, value, Icon]: any) => <div key={label} className="rounded-[14px] bg-[#f4f6f2] p-3"><Icon className="size-3.5 text-[#587060]" /><div className="mt-2 text-lg font-semibold tracking-[-.04em]">{value}</div><div className="text-[9px] uppercase tracking-[.08em] text-[#828a83]">{label}</div></div>)}</div>
    <div className="mt-5"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-[#7b857d]">Maintainer signals</div><div className="mt-2 flex flex-wrap gap-2">{signals.map((signal) => { const active = selected.includes(signal); return <button key={signal} onClick={() => setSelected(active ? selected.filter((item) => item !== signal) : [...selected, signal])} className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold transition ${active ? "border-[#9cc6a8] bg-[#e6f4ea] text-[#285a40]" : "border-black/8 bg-white text-[#687169]"}`}>{signal}</button>; })}</div><button disabled={saving} onClick={() => void save()} className="mt-3 inline-flex items-center gap-1.5 rounded-[11px] bg-[#163c2d] px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50">{saving && <LoaderCircle className="size-3 animate-spin" />}Save signals</button></div>
    <div className="mt-5 border-t border-black/7 pt-4"><div className="flex items-center justify-between"><span className="text-xs font-semibold">Recommended contribution surface</span><span className="text-[10px] text-[#7b847d]">{project.opportunities.length} indexed</span></div><div className="mt-2 space-y-1.5">{project.opportunities.slice(0, 4).map((issue) => <a key={issue.id} href={issue.canonicalUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-[12px] p-2.5 text-xs transition hover:bg-[#f4f6f2]"><span className="truncate">{issue.title}</span>{(issue.goodFirstIssue || issue.beginnerFriendly) && <span className="shrink-0 rounded-full bg-[#e7f4ea] px-2 py-1 text-[9px] font-bold text-[#315c43]">FIRST-TIMER</span>}</a>)}{!project.opportunities.length && <div className="flex items-start gap-2 rounded-[12px] bg-[#faf7ed] p-3 text-[11px] leading-5 text-[#776b4c]"><CircleAlert className="mt-0.5 size-3.5 shrink-0" />No indexed opportunities are linked yet. Keep the external repository&apos;s issues and contribution guide current so discovery can surface them.</div>}</div></div>
  </motion.article>;
}

function MaintainerSkeleton() { return <div className="space-y-5"><div className="skeleton h-72 rounded-[28px]" /><div className="grid gap-4 lg:grid-cols-2"><div className="skeleton h-96 rounded-[26px]" /><div className="skeleton h-96 rounded-[26px]" /></div></div>; }
