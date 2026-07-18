"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Cpu, FolderGit2, Plus, Search, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MotionDialog, type OriginRect } from "./motion-dialog";
import { springs } from "@/lib/motion";

type Role = { id: string; title: string; slots: number; skills: string[] };
type Room = {
  id: string;
  title: string;
  description?: string;
  hardware: boolean;
  technologies: string[];
  roleSlots: Role[];
  members: Array<{ id: string; role: string; user: { id: string; name: string; image?: string } }>;
  updatedAt: string;
};

export function RoomsClient() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<OriginRect>(null);
  const createRef = useRef<HTMLButtonElement>(null);

  const load = async (q = "") => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rooms?q=${encodeURIComponent(q)}`);
      const data = await response.json();
      setRooms(data.rooms ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);
  const openCreate = () => {
    const rect = createRef.current?.getBoundingClientRect();
    setOrigin(rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null);
    setOpen(true);
  };

  return (
    <div>
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row">
        <form onSubmit={(event) => { event.preventDefault(); void load(query); }} className="glass flex flex-1 items-center gap-3 rounded-[20px] p-2 pl-4">
          <Search className="size-4 text-[#738078]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Robotics, React, climate, accessibility…" className="h-10 flex-1 bg-transparent text-sm outline-none" />
          <button className="h-10 rounded-[13px] bg-[#163c2d] px-4 text-sm font-semibold text-white">Search rooms</button>
        </form>
        <button ref={createRef} onClick={openCreate} className="inline-flex h-[58px] items-center justify-center gap-2 rounded-[18px] bg-[#163c2d] px-5 text-sm font-semibold text-white shadow-sm">
          <Plus className="size-4" /> Start a room
        </button>
      </div>

      <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loading ? Array.from({ length: 6 }).map((_, index) => <RoomSkeleton key={index} />) : rooms.length ? rooms.map((room, index) => <RoomCard key={room.id} room={room} index={index} />) : <EmptyRooms onCreate={openCreate} />}
      </div>

      <MotionDialog open={open} onClose={() => setOpen(false)} title="Start a project room" originRect={origin} size="lg">
        <CreateRoomForm onCreated={(room) => { setRooms((current) => [room, ...current]); setOpen(false); }} />
      </MotionDialog>
    </div>
  );
}

function RoomCard({ room, index }: { room: Room; index: number }) {
  return (
    <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springs.snappy, delay: index * .025 }} className="surface group rounded-[24px] p-5">
      <div className="flex items-start justify-between gap-3">
        <span className={`grid size-11 place-items-center rounded-[14px] ${room.hardware ? "bg-[#f2eddf] text-[#6b542c]" : "bg-[#e8f3eb] text-[#2e6045]"}`}>{room.hardware ? <Cpu className="size-5" /> : <FolderGit2 className="size-5" />}</span>
        <div className="flex items-center gap-1.5 text-[11px] text-[#758078]"><Users className="size-3.5" />{room.members.length}</div>
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-[-.035em]">{room.title}</h2>
      <p className="mt-1.5 line-clamp-3 min-h-[60px] text-sm leading-5 text-[#687168]">{room.description ?? "An KOBI collaboration room."}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">{room.technologies.slice(0, 4).map((technology) => <span key={technology} className="rounded-full bg-[#f0f3ee] px-2.5 py-1 text-[10px] font-medium">{technology}</span>)}</div>
      <div className="mt-5 border-t border-black/7 pt-4">
        <div className="text-[10px] font-bold uppercase tracking-[.1em] text-[#7e887f]">Looking for</div>
        <div className="mt-2 min-h-10 text-xs leading-5 text-[#5f6961]">{room.roleSlots.length ? room.roleSlots.slice(0, 3).map((role) => `${role.title} · ${role.slots}`).join("  /  ") : "No open role slots right now"}</div>
        <Link href={`/project/${room.id}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#28563f]">Open room <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></Link>
      </div>
    </motion.article>
  );
}

function CreateRoomForm({ onCreated }: { onCreated: (room: Room) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hardware, setHardware] = useState(false);
  const [techInput, setTechInput] = useState("");
  const [technologies, setTechnologies] = useState<string[]>([]);
  const [roles, setRoles] = useState<Array<{ title: string; slots: number; skills: string[] }>>([]);
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canSubmit = title.trim().length >= 2;

  const addTech = () => {
    const value = techInput.trim();
    if (!value || technologies.includes(value)) return;
    setTechnologies((current) => [...current, value].slice(0, 20)); setTechInput("");
  };
  const addRole = () => {
    const value = role.trim(); if (!value) return;
    setRoles((current) => [...current, { title: value, slots: 1, skills: [] }].slice(0, 12)); setRole("");
  };

  return (
    <form onSubmit={async (event) => {
      event.preventDefault(); if (!canSubmit) return;
      setBusy(true); setError("");
      try {
        const response = await fetch("/api/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, description, hardware, technologies, roles }) });
        const data = await response.json();
        if (response.status === 401) throw new Error("Sign in before starting a room.");
        if (!response.ok) throw new Error(data.error ?? "Could not create room");
        onCreated(data.room);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create room"); }
      finally { setBusy(false); }
    }} className="space-y-5">
      <div><label className="text-xs font-semibold text-[#526057]">Project name</label><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 h-12 w-full rounded-[14px] border border-black/8 bg-[#fafbf8] px-4 text-sm outline-none focus:border-[#8db79d]" placeholder="Open climate sensor network" /></div>
      <div><label className="text-xs font-semibold text-[#526057]">What are you building?</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="mt-2 w-full resize-none rounded-[14px] border border-black/8 bg-[#fafbf8] p-4 text-sm leading-6 outline-none focus:border-[#8db79d]" placeholder="Explain the problem, current state, and who would be useful on the team." /></div>
      <button type="button" onClick={() => setHardware((value) => !value)} className={`flex w-full items-center justify-between rounded-[14px] border p-4 text-left text-sm ${hardware ? "border-[#c6b47c] bg-[#f7f2e5]" : "border-black/8 bg-white"}`}><span><strong>Hardware / physical project</strong><span className="mt-1 block text-xs font-normal text-[#748077]">Enables firmware, PCB, CAD, robotics and hardware matching.</span></span><span className={`h-6 w-10 rounded-full p-1 transition ${hardware ? "bg-[#76602f]" : "bg-black/10"}`}><span className={`block size-4 rounded-full bg-white transition ${hardware ? "translate-x-4" : ""}`} /></span></button>
      <TagEditor label="Technologies" value={techInput} onChange={setTechInput} onAdd={addTech} tags={technologies} onRemove={(tag) => setTechnologies((current) => current.filter((item) => item !== tag))} placeholder="React, ESP32, KiCad…" />
      <TagEditor label="Roles you need" value={role} onChange={setRole} onAdd={addRole} tags={roles.map((item) => item.title)} onRemove={(tag) => setRoles((current) => current.filter((item) => item.title !== tag))} placeholder="Frontend developer, embedded engineer…" />
      {error && <div className="rounded-[13px] bg-[#fff1ef] px-3 py-2 text-xs text-[#9b342a]">{error}</div>}
      <div className="flex justify-end"><button disabled={!canSubmit || busy} className="h-11 rounded-[14px] bg-[#163c2d] px-5 text-sm font-semibold text-white disabled:opacity-45">{busy ? "Creating…" : "Create project room"}</button></div>
    </form>
  );
}

function TagEditor({ label, value, onChange, onAdd, tags, onRemove, placeholder }: { label: string; value: string; onChange: (value: string) => void; onAdd: () => void; tags: string[]; onRemove: (tag: string) => void; placeholder: string }) {
  return <div><label className="text-xs font-semibold text-[#526057]">{label}</label><div className="mt-2 flex gap-2"><input value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onAdd(); } }} className="h-11 flex-1 rounded-[13px] border border-black/8 bg-[#fafbf8] px-3 text-sm outline-none focus:border-[#8db79d]" placeholder={placeholder} /><button type="button" onClick={onAdd} className="h-11 rounded-[13px] border border-black/8 px-3 text-sm font-semibold">Add</button></div><AnimatePresence>{tags.length > 0 && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 flex flex-wrap gap-1.5">{tags.map((tag) => <motion.button type="button" layout key={tag} onClick={() => onRemove(tag)} className="inline-flex items-center gap-1 rounded-full bg-[#edf3ed] px-2.5 py-1 text-[10px] font-medium">{tag}<X className="size-3" /></motion.button>)}</motion.div>}</AnimatePresence></div>;
}

function RoomSkeleton() { return <div className="surface rounded-[24px] p-5"><div className="skeleton size-11 rounded-[14px]" /><div className="skeleton mt-4 h-5 w-3/5 rounded-lg" /><div className="skeleton mt-3 h-4 w-full rounded-lg" /><div className="skeleton mt-2 h-4 w-4/5 rounded-lg" /><div className="skeleton mt-8 h-12 w-full rounded-[14px]" /></div>; }
function EmptyRooms({ onCreate }: { onCreate: () => void }) { return <div className="surface col-span-full rounded-[28px] p-9 text-center"><Users className="mx-auto size-7 text-[#607067]" /><h2 className="mt-3 text-xl font-semibold tracking-[-.035em]">Start the first room in this search.</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#6d776f]">Coordinate people, roles, tasks and discussion without trying to replace the repository where the real work lives.</p><button onClick={onCreate} className="mt-5 rounded-[13px] bg-[#163c2d] px-4 py-2.5 text-sm font-semibold text-white">Start a room</button></div>; }
