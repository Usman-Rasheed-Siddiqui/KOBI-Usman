"use client";

import { authClient } from "@/lib/auth-client";
import { ArrowRight, GitBranch, GitPullRequest, MapPin, Network, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ProfileSkeleton } from "./skeletons";

type GithubSummary = {
  username?: string;
  url?: string;
  avatarUrl?: string;
  bio?: string | null;
  location?: string | null;
  publicRepos?: number;
  followers?: number;
  languages?: Array<{ name: string; count: number }>;
  frameworks?: string[];
  projects?: Array<{ name: string; url: string; description?: string | null; language?: string | null; topics: string[]; stars: number; pushedAt: string }>;
};

type ProfileData = {
  github?: GithubSummary;
  user?: {
    name: string;
    email: string;
    image?: string;
    profile?: {
      headline?: string;
      bio?: string;
      location?: string;
      experienceLevel: string;
      interests: string[];
      goals: string[];
      contributionDna?: Record<string, unknown> | null;
    } | null;
    skills: Array<{ level: string; evidenceType: string; strength: number; skill: { name: string } }>;
    contributions: Array<{ id: string; title: string; merged: boolean; externalUrl: string }>;
  } | null;
};

export function ProfileClient() {
  const { data: session, isPending } = authClient.useSession();
  const [data, setData] = useState<ProfileData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    fetch("/api/profile").then((response) => response.json()).then(setData).finally(() => setLoading(false));
  }, [session]);

  if (isPending || loading) return <ProfileSkeleton />;
  if (!session) return <SignedOut />;

  const user = data.user;
  const github = data.github;
  const verified = user?.skills.filter((skill) => skill.evidenceType !== "SELF_REPORTED") ?? [];
  const selfReported = user?.skills.filter((skill) => skill.evidenceType === "SELF_REPORTED") ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <section className="surface rounded-[30px] p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-[#dfeee3] text-2xl font-semibold text-[#28543d]">
            {github?.avatarUrl ? <Image src={github.avatarUrl} alt="" width={80} height={80} className="size-full object-cover" /> : session.user.name?.[0] ?? "K"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-[-.05em]">{session.user.name}</h1>
              <span className="rounded-full bg-[#e9f5ec] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] text-[#286246]">KOBI Fit profile</span>
            </div>
            <p className="mt-1 text-sm text-[#6c756e]">{user?.profile?.headline ?? github?.bio ?? "A grounded developer profile built from your preferences and connected GitHub signals."}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#667069]">
              <span>{user?.profile?.experienceLevel ?? "Profile starting"}</span>
              {(user?.profile?.location || github?.location) && <><span>-</span><span>{user?.profile?.location ?? github?.location}</span></>}
              {github?.username && <><span>-</span><a href={github.url} target="_blank" rel="noreferrer" className="font-semibold text-[#315f47]">@{github.username}</a></>}
            </div>
          </div>
          <Link href="/onboarding" className="inline-flex h-10 items-center gap-2 rounded-[13px] border border-black/8 bg-white px-4 text-sm font-semibold">Edit profile <ArrowRight className="size-4" /></Link>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="surface rounded-[24px] p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold"><Network className="size-4" />Developer signal graph</div>
            {github?.username && <span className="text-xs text-[#748077]">Synced from GitHub</span>}
          </div>
          <div className="mt-5 min-h-72 rounded-[20px] border border-black/7 bg-[#f7f9f5] p-4">
            <SkillGraph skills={user?.skills.map((skill) => ({ name: skill.skill.name, verified: skill.evidenceType !== "SELF_REPORTED" })) ?? []} />
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-[#748077]">
            <span><i className="mr-1.5 inline-block size-2 rounded-full bg-[#245b40]" />GitHub or work-derived</span>
            <span><i className="mr-1.5 inline-block size-2 rounded-full bg-[#b8c3ba]" />Self-reported</span>
          </div>
        </section>

        <section className="space-y-4">
          <div className="surface rounded-[24px] p-5">
            <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" />KOBI Fit signals</div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Stat n={github?.publicRepos ?? 0} label="GitHub repos" />
              <Stat n={github?.followers ?? 0} label="Followers" />
              <Stat n={verified.length} label="Derived skills" />
              <Stat n={selfReported.length} label="Self-reported" />
            </div>
          </div>
          <div className="rounded-[24px] border border-[#bdd9c5] bg-[#eaf5ed] p-5">
            <div className="font-semibold text-[#244f39]">Personalization stays subordinate.</div>
            <p className="mt-2 text-xs leading-5 text-[#516b5a]">KOBI Fit helps rank results, but explicit searches still win. If you ask for Rust, KOBI will not silently pull you back to React.</p>
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="surface rounded-[24px] p-5">
          <div className="flex items-center gap-2 font-semibold"><GitBranch className="size-4" />Languages and frameworks</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[...(github?.languages?.map((language) => language.name) ?? []), ...(github?.frameworks ?? []), ...(user?.profile?.interests ?? [])].slice(0, 22).map((item) => (
              <span key={item} className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-semibold text-[#516157]">{item}</span>
            ))}
            {!github?.languages?.length && !user?.profile?.interests?.length && <p className="text-sm text-[#748077]">Connect GitHub or complete onboarding to seed KOBI Fit.</p>}
          </div>
        </section>

        <section className="surface rounded-[24px] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold"><GitPullRequest className="size-4" />Selected GitHub projects</div>
            <Link href="/forge" className="text-xs font-semibold text-[#315f47]">Find matches</Link>
          </div>
          {github?.projects?.length ? (
            <div className="mt-4 space-y-2">
              {github.projects.slice(0, 5).map((project) => (
                <a key={project.url} href={project.url} target="_blank" rel="noreferrer" className="block rounded-[16px] border border-black/7 bg-[#fafbf8] p-3 transition hover:bg-white">
                  <div className="flex items-center justify-between gap-3 text-sm font-semibold"><span className="truncate">{project.name}</span><span className="inline-flex items-center gap-1 text-xs text-[#748077]"><Star className="size-3" />{project.stars}</span></div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#687168]">{project.description ?? "GitHub repository"}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-[#728076]">
                    {project.language && <span>{project.language}</span>}
                    {project.topics.slice(0, 3).map((topic) => <span key={topic}>{topic}</span>)}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#748077]">Connect with GitHub to show real public project signals here.</p>
          )}
        </section>
      </div>

      <section className="surface mt-4 rounded-[24px] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold"><MapPin className="size-4" />Goals and interests</div>
          <Link href="/pulse" className="text-xs font-semibold text-[#315f47]">Find events</Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[...(user?.profile?.goals ?? []), ...(user?.profile?.interests ?? [])].map((item) => (
            <span key={item} className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-semibold text-[#516157]">{item}</span>
          ))}
          {!user?.profile?.goals?.length && !user?.profile?.interests?.length && <p className="text-sm text-[#748077]">Add goals in onboarding so KOBI Pulse, Forge, Discover, and Agent can rank more personally.</p>}
        </div>
      </section>
    </div>
  );
}

function SignedOut() {
  return (
    <div className="surface mx-auto max-w-xl rounded-[28px] p-8 text-center">
      <h1 className="text-2xl font-semibold tracking-[-.04em]">Your KOBI Fit profile starts here.</h1>
      <p className="mt-3 text-sm leading-6 text-[#6c766e]">Log in to save opportunities, map onboarding preferences, and build a grounded profile from your GitHub activity.</p>
      <Link href="/login?mode=signup" className="mt-5 inline-flex rounded-[13px] bg-[#163c2d] px-5 py-2.5 text-sm font-semibold text-white">Sign up or log in</Link>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return <div className="rounded-[16px] border border-black/7 bg-[#fafbf8] p-3"><div className="text-2xl font-semibold tracking-[-.05em]">{n}</div><div className="mt-1 text-[10px] uppercase tracking-[.08em] text-[#7b847c]">{label}</div></div>;
}

function SkillGraph({ skills }: { skills: Array<{ name: string; verified: boolean }> }) {
  if (!skills.length) return <div className="grid h-64 place-items-center text-center text-sm text-[#78817a]">Connect GitHub or add skills in onboarding. KOBI only shows supported signals here.</div>;
  const cx = 260;
  const cy = 135;
  const radius = 95;
  return (
    <svg viewBox="0 0 520 270" className="h-64 w-full" role="img" aria-label="Skill graph">
      {skills.slice(0, 12).map((skill, index) => {
        const angle = (index / Math.min(skills.length, 12)) * Math.PI * 2;
        const x = cx + Math.cos(angle) * radius * (index % 2 ? 1.15 : .85);
        const y = cy + Math.sin(angle) * radius * (index % 2 ? 1.1 : .8);
        return (
          <g key={skill.name}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(40,70,50,.13)" />
            <circle cx={x} cy={y} r={skill.verified ? 24 : 20} fill={skill.verified ? "#245b40" : "#d8dfd8"} />
            <text x={x} y={y + 3} textAnchor="middle" fontSize="9" fill={skill.verified ? "white" : "#425047"}>{skill.name.slice(0, 10)}</text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r="32" fill="#eff4ee" stroke="rgba(20,40,27,.12)" />
      <text x={cx} y={cy + 3} textAnchor="middle" fontSize="10" fill="#294a37">YOU</text>
    </svg>
  );
}
