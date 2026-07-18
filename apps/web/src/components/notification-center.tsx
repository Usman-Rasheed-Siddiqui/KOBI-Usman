"use client";

import { AnimatePresence, motion } from "motion/react";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { springs } from "@/lib/motion";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  url?: string;
  read: boolean;
  createdAt: string;
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setItems(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    } catch { /* Notification failure never blocks navigation. */ }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const mark = async (id?: string) => {
    const previous = items;
    const next = items.map((item) => (!id || item.id === id) ? { ...item, read: true } : item);
    setItems(next);
    setUnread(next.filter((item) => !item.read).length);
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(id ? { id } : { all: true }),
    });
    if (!response.ok) {
      setItems(previous);
      setUnread(previous.filter((item) => !item.read).length);
    }
  };

  return (
    <div className="relative" ref={root}>
      <button onClick={() => setOpen((value) => !value)} aria-label="Notifications" aria-expanded={open} className="focus-ring relative grid size-9 place-items-center rounded-xl border border-black/8 bg-white/70 transition hover:bg-white">
        <Bell className="size-4" />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-[#163c2d] px-1 text-[9px] font-bold leading-4 text-white">{Math.min(unread, 99)}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: .97, transformOrigin: "top right" }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: .98 }}
            transition={springs.snappy}
            className="glass absolute right-0 top-12 z-[70] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-[22px] shadow-[0_28px_90px_rgba(17,35,24,.18)]"
          >
            <div className="flex items-center justify-between border-b border-black/7 px-4 py-3">
              <div><div className="text-sm font-semibold">Notifications</div><div className="text-[11px] text-[#778079]">Radar and collaboration updates</div></div>
              {unread > 0 && <button onClick={() => void mark()} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#315f47] hover:bg-black/5"><CheckCheck className="size-3.5" />Mark all read</button>}
            </div>
            <div className="max-h-[min(520px,70dvh)] overflow-y-auto p-2">
              {items.length ? items.map((item) => {
                const content = (
                  <div className={`rounded-[15px] p-3 transition hover:bg-black/[.035] ${item.read ? "" : "bg-[#edf6ef]"}`}>
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read ? "bg-black/15" : "bg-[#2a6849]"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold leading-5">{item.title}</div>
                        <p className="mt-0.5 text-xs leading-5 text-[#667068]">{item.body}</p>
                        <div className="mt-1.5 text-[10px] text-[#899088]">{new Date(item.createdAt).toLocaleString()}</div>
                      </div>
                      {item.url && <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-[#7b857d]" />}
                    </div>
                  </div>
                );
                return item.url ? <a key={item.id} href={item.url} target="_blank" rel="noreferrer" onClick={() => void mark(item.id)}>{content}</a> : <button key={item.id} onClick={() => void mark(item.id)} className="block w-full text-left">{content}</button>;
              }) : <div className="p-7 text-center text-sm text-[#748077]">Nothing needs your attention right now.</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
