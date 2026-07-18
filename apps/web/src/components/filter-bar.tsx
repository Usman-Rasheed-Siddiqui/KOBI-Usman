"use client";

import { motion } from "motion/react";
import { CalendarDays, Check, CircleDot, Clock3, Cpu, Gem, MapPin, Radio, RotateCcw, SlidersHorizontal, Sparkles, Timer, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type DiscoveryVariant = "all" | "pulse" | "forge" | "projects" | "hardware";

export type SearchFilters = {
  fast: boolean;
  hard: boolean;
  beginner: boolean;
  hardware: boolean;
  hiddenGems: boolean;
  smallScope: boolean;
  goodFirstIssue: boolean;
  helpWanted: boolean;
  remote: boolean;
  difficulty: string[];
  updatedWithinDays?: number;
  source?: string;
  location: string;
  datePreset?: "upcoming" | "week" | "month" | "historical" | "custom";
  eventMode?: "REMOTE" | "PHYSICAL" | "HYBRID" | "";
  eventType?: string;
  includeProjects: boolean;
};

export const emptySearchFilters = (variant: DiscoveryVariant = "all"): SearchFilters => ({
  fast: true,
  hard: false,
  beginner: false,
  hardware: variant === "hardware",
  hiddenGems: false,
  smallScope: false,
  goodFirstIssue: false,
  helpWanted: false,
  remote: false,
  difficulty: [],
  updatedWithinDays: variant === "forge" ? 90 : undefined,
  source: undefined,
  location: "",
  datePreset: variant === "pulse" ? "upcoming" : undefined,
  eventMode: "",
  eventType: undefined,
  includeProjects: variant === "forge",
});

const difficultyOptions = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

export function FilterBar({ value, onChange, variant = "all" }: { value: SearchFilters; onChange: (value: SearchFilters) => void; variant?: DiscoveryVariant }) {
  const isPulse = variant === "pulse";
  const isForge = variant === "forge" || variant === "hardware" || variant === "projects";
  const isAll = variant === "all";
  const set = (patch: Partial<SearchFilters>) => onChange({ ...value, ...patch });
  const reset = () => onChange(emptySearchFilters(variant));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={value.fast && !value.hard} onClick={() => set({ fast: !value.fast, hard: false })} icon={<Zap className="size-3.5" />} label={value.fast && !value.hard ? "Fast Mode" : "Normal Mode"} />
        <FilterChip active={value.hard} onClick={() => set({ hard: !value.hard, fast: value.hard })} icon={<SlidersHorizontal className="size-3.5" />} label="Hard Search" />
        {isPulse ? (
          <>
            <FilterChip active={value.datePreset === "upcoming"} onClick={() => set({ datePreset: "upcoming" })} icon={<CalendarDays className="size-3.5" />} label="Upcoming" />
            <FilterChip active={value.datePreset === "week"} onClick={() => set({ datePreset: "week" })} icon={<Clock3 className="size-3.5" />} label="This week" />
            <FilterChip active={value.datePreset === "month"} onClick={() => set({ datePreset: "month" })} icon={<CalendarDays className="size-3.5" />} label="This month" />
            <FilterChip active={value.eventMode === "REMOTE"} onClick={() => set({ eventMode: value.eventMode === "REMOTE" ? "" : "REMOTE", remote: value.eventMode !== "REMOTE" })} icon={<Radio className="size-3.5" />} label="Online" />
            <FilterChip active={value.eventMode === "PHYSICAL"} onClick={() => set({ eventMode: value.eventMode === "PHYSICAL" ? "" : "PHYSICAL", remote: false })} icon={<MapPin className="size-3.5" />} label="In person" />
          </>
        ) : null}
        {isForge ? (
          <>
            <FilterChip active={value.goodFirstIssue || value.beginner} onClick={() => set({ goodFirstIssue: !value.goodFirstIssue, beginner: !value.goodFirstIssue })} icon={<Sparkles className="size-3.5" />} label="Beginner" />
            <FilterChip active={value.helpWanted} onClick={() => set({ helpWanted: !value.helpWanted })} icon={<CircleDot className="size-3.5" />} label="Help wanted" />
            <FilterChip active={value.smallScope} onClick={() => set({ smallScope: !value.smallScope })} icon={<Timer className="size-3.5" />} label="Small scope" />
            <FilterChip active={value.hiddenGems} onClick={() => set({ hiddenGems: !value.hiddenGems })} icon={<Gem className="size-3.5" />} label="Hidden gems" />
            <FilterChip active={value.hardware} onClick={() => set({ hardware: !value.hardware })} icon={<Cpu className="size-3.5" />} label="Hardware" />
          </>
        ) : null}
        {isAll ? (
          <>
            <FilterChip active={value.beginner || value.goodFirstIssue} onClick={() => set({ beginner: !value.beginner, goodFirstIssue: !value.beginner })} icon={<Sparkles className="size-3.5" />} label="Beginner" />
            <FilterChip active={value.remote} onClick={() => set({ remote: !value.remote, eventMode: value.remote ? "" : "REMOTE" })} icon={<Radio className="size-3.5" />} label="Online" />
            <FilterChip active={value.updatedWithinDays === 30} onClick={() => set({ updatedWithinDays: value.updatedWithinDays === 30 ? undefined : 30 })} icon={<Clock3 className="size-3.5" />} label="Recent" />
          </>
        ) : null}
        <button onClick={reset} className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-[#717a72] hover:bg-black/5"><RotateCcw className="size-3.5" />Reset</button>
      </div>

      <div className="grid gap-2 rounded-[20px] border border-black/7 bg-white/55 p-2 sm:grid-cols-3">
        {isPulse ? (
          <>
            <label className="flex items-center gap-2 rounded-[14px] bg-white px-3">
              <MapPin className="size-4 text-[#7a847c]" />
              <input value={value.location} onChange={(event) => set({ location: event.target.value })} placeholder="City or country" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <select value={value.eventType ?? ""} onChange={(event) => set({ eventType: event.target.value || undefined })} className="h-10 rounded-[14px] border border-black/8 bg-white px-3 text-sm outline-none">
              <option value="">Any event type</option>
              <option value="Hackathon">Hackathons</option>
              <option value="Conference">Conferences</option>
              <option value="Workshop">Workshops</option>
              <option value="Meetup">Meetups</option>
            </select>
            <select value={value.source ?? ""} onChange={(event) => set({ source: event.target.value || undefined })} className="h-10 rounded-[14px] border border-black/8 bg-white px-3 text-sm outline-none">
              <option value="">All event sources</option>
              <option value="developers-events">Developers Events</option>
              <option value="hackclub">Hack Club Hackathons</option>
              <option value="configured-events">Approved event pages</option>
            </select>
          </>
        ) : isForge ? (
          <>
            <select value={value.updatedWithinDays ?? ""} onChange={(event) => set({ updatedWithinDays: event.target.value ? Number(event.target.value) : undefined })} className="h-10 rounded-[14px] border border-black/8 bg-white px-3 text-sm outline-none">
              <option value="">Any freshness</option>
              <option value="7">Updated this week</option>
              <option value="30">Updated this month</option>
              <option value="90">Updated recently</option>
            </select>
            <select value={value.difficulty[0] ?? ""} onChange={(event) => set({ difficulty: event.target.value ? [event.target.value] : [] })} className="h-10 rounded-[14px] border border-black/8 bg-white px-3 text-sm outline-none">
              <option value="">Any difficulty</option>
              {difficultyOptions.map((level) => <option key={level} value={level}>{level.charAt(0) + level.slice(1).toLowerCase()}</option>)}
            </select>
            <label className="flex h-10 items-center justify-between rounded-[14px] border border-black/8 bg-white px-3 text-sm">
              Include projects
              <button type="button" onClick={() => set({ includeProjects: !value.includeProjects })} className={cn("grid size-5 place-items-center rounded-full border", value.includeProjects ? "border-[#4c8b65] bg-[#4c8b65] text-white" : "border-black/15")}>{value.includeProjects && <Check className="size-3" />}</button>
            </label>
          </>
        ) : (
          <>
            <label className="flex items-center gap-2 rounded-[14px] bg-white px-3">
              <MapPin className="size-4 text-[#7a847c]" />
              <input value={value.location} onChange={(event) => set({ location: event.target.value })} placeholder="Optional location" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <select value={value.updatedWithinDays ?? ""} onChange={(event) => set({ updatedWithinDays: event.target.value ? Number(event.target.value) : undefined })} className="h-10 rounded-[14px] border border-black/8 bg-white px-3 text-sm outline-none">
              <option value="">Any saved freshness</option>
              <option value="7">Updated this week</option>
              <option value="30">Updated this month</option>
              <option value="90">Updated recently</option>
            </select>
            <select value={value.eventMode || ""} onChange={(event) => set({ eventMode: event.target.value as SearchFilters["eventMode"], remote: event.target.value === "REMOTE" })} className="h-10 rounded-[14px] border border-black/8 bg-white px-3 text-sm outline-none">
              <option value="">Any event mode</option>
              <option value="REMOTE">Online events</option>
              <option value="PHYSICAL">In-person events</option>
              <option value="HYBRID">Hybrid events</option>
            </select>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-[#778079]">
        <SlidersHorizontal className="size-3.5" />
        {value.hard ? "Hard Search starts normally, then searches deeper if KOBI still needs stronger matches." : value.fast ? "Fast Mode checks saved KOBI discoveries first, then searches a smaller set of high-value sources." : "Normal Mode checks saved discoveries, then searches the regular source set."}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <motion.button
      whileTap={{ scale: .97 }}
      onClick={onClick}
      className={cn("focus-ring inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-medium transition", active ? "border-[#9bc9aa] bg-[#e7f5ec] text-[#194c35]" : "border-black/8 bg-white/65 text-[#5f6961] hover:bg-white")}
    >
      {icon}{label}
    </motion.button>
  );
}
