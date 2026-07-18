"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Circle, Clock3, MessageCircle, Plus, Send, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { springs } from "@/lib/motion";

type RoomData = {
  id: string;
  roleSlots: Array<{ id: string; title: string; description?: string; slots: number; skills: string[]; open: boolean; requests: Array<{ id: string; status: string; message?: string; requester: { id: string; name: string } }> }>;
  members: Array<{ id: string; role: string; userId: string; user: { id: string; name: string } }>;
  tasks: Array<{ id: string; title: string; description?: string; status: string }>;
  posts: Array<{ id: string; kind: string; content: string; createdAt: string; author: { id: string; name: string } }>;
};
type Viewer = { signedIn: boolean; userId?: string; membership?: { role: string; status: string } | null; manager: boolean };

export function RoomPanel({ projectId, enabled = true }: { projectId: string; enabled?: boolean }) {
  const [room, setRoom] = useState<RoomData | null>(null);
  const [viewer, setViewer] = useState<Viewer>({ signedIn: false, manager: false });
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  const load = async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/rooms/${projectId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load room");
      setRoom(data.room); setViewer(data.viewer ?? { signedIn: false, manager: false });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load room"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [projectId, enabled]);

  if (!enabled) return null;
  if (loading) return <div className="surface mt-4 rounded-[24px] p-5"><div className="skeleton h-5 w-36 rounded-lg" /><div className="mt-5 grid gap-3 lg:grid-cols-2"><div className="skeleton h-48 rounded-[18px]" /><div className="skeleton h-48 rounded-[18px]" /></div></div>;
  if (!room || error) return <div className="mt-4 rounded-[20px] border border-black/8 bg-white/60 p-4 text-sm text-[#6f7971]">{error || "Room data is unavailable."}</div>;

  const member = viewer.membership?.status === "ACTIVE";
  return (
    <section className="surface mt-4 rounded-[26px] p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-2 font-semibold"><Users className="size-4" />Live project room</div><p className="mt-1 text-xs text-[#748077]">Coordinate here. Keep code, issues and releases on the source repository.</p></div>
        <div className="flex -space-x-2">{room.members.slice(0, 5).map((memberItem) => <span key={memberItem.id} title={`${memberItem.user.name} · ${memberItem.role}`} className="grid size-8 place-items-center rounded-full border-2 border-white bg-[#e5efe7] text-[10px] font-bold text-[#315a43]">{memberItem.user.name.slice(0, 1)}</span>)}</div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <div className="space-y-4">
          <RoomRoles projectId={projectId} roles={room.roleSlots} viewer={viewer} onChanged={load} />
          <RoomTasks projectId={projectId} tasks={room.tasks} editable={Boolean(member)} onChanged={load} />
        </div>
        <RoomDiscussion projectId={projectId} posts={room.posts} editable={Boolean(member)} onChanged={load} />
      </div>
    </section>
  );
}

function RoomRoles({ projectId, roles, viewer, onChanged }: { projectId: string; roles: RoomData["roleSlots"]; viewer: Viewer; onChanged: () => Promise<void> }) {
  const [messageRole, setMessageRole] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  return <div className="rounded-[20px] border border-black/7 bg-[#fafbf8] p-4"><div className="flex items-center justify-between"><div className="text-sm font-semibold">Open roles</div><span className="text-[10px] uppercase tracking-[.08em] text-[#7f8881]">{roles.filter((role) => role.open).length} open</span></div><div className="mt-3 space-y-2">{roles.filter((role) => role.open).length ? roles.filter((role) => role.open).map((role) => <div key={role.id} className="rounded-[15px] border border-black/7 bg-white p-3"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold">{role.title}</div><div className="mt-1 text-[11px] text-[#768078]">{role.slots} slot(s){role.skills.length ? ` · ${role.skills.join(", ")}` : ""}</div></div>{!viewer.membership && <button onClick={() => setMessageRole(messageRole === role.id ? null : role.id)} className="inline-flex items-center gap-1 rounded-[10px] bg-[#edf4ef] px-2.5 py-1.5 text-[11px] font-semibold text-[#315c44]"><UserPlus className="size-3" />Request</button>}</div><AnimatePresence>{messageRole === role.id && <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden" onSubmit={async (event) => { event.preventDefault(); setStatus(""); const response = await fetch(`/api/rooms/${projectId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "join", roleId: role.id, message }) }); const data = await response.json(); setStatus(response.ok ? "Request sent." : data.error ?? "Could not send request"); if (response.ok) { setMessageRole(null); setMessage(""); await onChanged(); } }}><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="A short note about why this fits you…" rows={3} className="mt-3 w-full resize-none rounded-[12px] border border-black/8 bg-[#fafbf8] p-3 text-xs outline-none" /><button className="mt-2 rounded-[10px] bg-[#163c2d] px-3 py-2 text-[11px] font-semibold text-white">Send request</button></motion.form>}</AnimatePresence>{viewer.manager && role.requests.filter((request) => request.status === "PENDING").map((request) => <div key={request.id} className="mt-3 rounded-[12px] bg-[#f4f6f2] p-3 text-xs"><div className="font-semibold">{request.requester.name}</div>{request.message && <p className="mt-1 leading-5 text-[#687168]">{request.message}</p>}<div className="mt-2 flex gap-2"><button onClick={async () => { await fetch(`/api/rooms/${projectId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "request-status", requestId: request.id, status: "ACTIVE" }) }); await onChanged(); }} className="rounded-lg bg-[#dff1e5] px-2.5 py-1.5 font-semibold text-[#28573f]">Accept</button><button onClick={async () => { await fetch(`/api/rooms/${projectId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "request-status", requestId: request.id, status: "REJECTED" }) }); await onChanged(); }} className="rounded-lg bg-black/5 px-2.5 py-1.5">Decline</button></div></div>)}</div>) : <div className="rounded-[14px] bg-white p-3 text-xs text-[#758078]">This team is not advertising roles right now.</div>}</div>{status && <div className="mt-2 text-[11px] text-[#52685a]">{status}</div>}</div>;
}

function RoomTasks({ projectId, tasks, editable, onChanged }: { projectId: string; tasks: RoomData["tasks"]; editable: boolean; onChanged: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const statusOrder = ["TODO", "IN_PROGRESS", "DONE"];
  return <div className="rounded-[20px] border border-black/7 bg-[#fafbf8] p-4"><div className="flex items-center justify-between"><div className="text-sm font-semibold">Tasks</div><span className="text-[10px] uppercase tracking-[.08em] text-[#7f8881]">{tasks.filter((task) => task.status !== "DONE").length} active</span></div>{editable && <form onSubmit={async (event) => { event.preventDefault(); if (!title.trim()) return; await fetch(`/api/rooms/${projectId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "task", title }) }); setTitle(""); await onChanged(); }} className="mt-3 flex gap-2"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a focused task…" className="h-9 flex-1 rounded-[11px] border border-black/8 bg-white px-3 text-xs outline-none" /><button aria-label="Add task" className="grid size-9 place-items-center rounded-[11px] bg-[#163c2d] text-white"><Plus className="size-3.5" /></button></form>}<div className="mt-3 space-y-1.5">{tasks.length ? tasks.slice(0, 12).map((task) => { const next = statusOrder[(statusOrder.indexOf(task.status) + 1) % statusOrder.length] ?? "TODO"; return <button disabled={!editable} onClick={async () => { if (!editable) return; await fetch(`/api/rooms/${projectId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "task-status", taskId: task.id, status: next }) }); await onChanged(); }} key={task.id} className="flex w-full items-start gap-2 rounded-[12px] p-2 text-left transition hover:bg-white disabled:cursor-default"><span className={`mt-0.5 grid size-5 place-items-center rounded-full border ${task.status === "DONE" ? "border-[#8bb29a] bg-[#dff0e4] text-[#28583f]" : "border-black/15 bg-white"}`}>{task.status === "DONE" ? <Check className="size-3" /> : task.status === "IN_PROGRESS" ? <Clock3 className="size-3" /> : <Circle className="size-2.5" />}</span><span><span className={`block text-xs font-medium ${task.status === "DONE" ? "text-[#8a918b] line-through" : ""}`}>{task.title}</span>{task.description && <span className="mt-0.5 block text-[11px] leading-4 text-[#7a837c]">{task.description}</span>}</span></button>; }) : <div className="py-3 text-xs text-[#7b847d]">No tasks yet. Keep the room lightweight.</div>}</div></div>;
}

function RoomDiscussion({ projectId, posts, editable, onChanged }: { projectId: string; posts: RoomData["posts"]; editable: boolean; onChanged: () => Promise<void> }) {
  const [content, setContent] = useState("");
  return <div className="flex min-h-[420px] flex-col rounded-[20px] border border-black/7 bg-[#fafbf8] p-4"><div className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="size-4" />Discussion & updates</div><div className="mt-3 flex-1 space-y-2 overflow-y-auto">{posts.length ? posts.map((post) => <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={springs.snappy} key={post.id} className="rounded-[14px] bg-white p-3"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold">{post.author?.name ?? "Member"}</span><span className="text-[9px] uppercase tracking-[.08em] text-[#899189]">{post.kind}</span></div><p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-[#5f6961]">{post.content}</p><div className="mt-1.5 text-[9px] text-[#8a928c]">{new Date(post.createdAt).toLocaleString()}</div></motion.div>) : <div className="grid min-h-52 place-items-center text-center text-xs leading-5 text-[#7b847d]">No discussion yet.<br />Use this space for coordination, not repository issue tracking.</div>}</div>{editable ? <form onSubmit={async (event) => { event.preventDefault(); if (!content.trim()) return; await fetch(`/api/rooms/${projectId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "post", kind: "DISCUSSION", content }) }); setContent(""); await onChanged(); }} className="mt-3 flex items-end gap-2 rounded-[14px] border border-black/8 bg-white p-2 pl-3"><textarea rows={1} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Share a decision, blocker or update…" className="max-h-28 min-h-9 flex-1 resize-none bg-transparent py-2 text-xs outline-none" /><button aria-label="Post message" className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[#163c2d] text-white"><Send className="size-3.5" /></button></form> : <div className="mt-3 rounded-[12px] bg-white p-3 text-xs text-[#758078]">Join this project room to post updates and manage tasks.</div>}</div>;
}
