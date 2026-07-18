"use client";
import { AnimatePresence, motion } from "motion/react";
import { Archive, Bot, CalendarDays, FolderGit2, GitPullRequest, Search, ShieldCheck, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { springs } from "@/lib/motion";

const commands = [
  { label: "Search KOBI Forge", href: "/forge", icon: GitPullRequest },
  { label: "Search KOBI Pulse", href: "/pulse", icon: CalendarDays },
  { label: "Browse Pulse Collection", href: "/pulse/collection", icon: Archive },
  { label: "Browse Forge Collection", href: "/forge/collection", icon: Archive },
  { label: "Ask KOBI Agent", href: "/agent", icon: Bot },
  { label: "Explore projects", href: "/projects", icon: FolderGit2 },
  { label: "Find collaborators", href: "/collaborators", icon: Users },
  { label: "Maintainer mode", href: "/maintainers", icon: ShieldCheck },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const items = commands.filter((command) => command.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[100] flex items-start justify-center p-3 pt-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button aria-label="Close command palette" onClick={() => setOpen(false)} className="absolute inset-0 bg-[#07140e]/25 backdrop-blur-[5px]" />
          <motion.div initial={{ opacity: 0, scale: .96, y: -12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .97, y: -8 }} transition={springs.snappy} className="relative w-full max-w-xl overflow-hidden rounded-[24px] border border-white/70 bg-[#fbfcf8] shadow-[0_30px_100px_rgba(5,20,12,.25)]">
            <div className="flex items-center gap-3 border-b border-black/7 px-4">
              <Search className="size-4 text-[#687168]" />
              <input autoFocus value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search KOBI or type a command..." className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#899189]" />
              <button onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-lg hover:bg-black/5"><X className="size-4" /></button>
            </div>
            <div className="p-2">
              {items.map(({ label, href, icon: Icon }) => (
                <button key={label} onClick={() => { setOpen(false); router.push(href); }} className="flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left text-sm transition hover:bg-black/[.045]">
                  <span className="grid size-9 place-items-center rounded-xl border border-black/7 bg-white"><Icon className="size-4" /></span>
                  <span className="font-medium">{label}</span>
                </button>
              ))}
              <div className="px-3 pb-2 pt-3 text-[11px] text-[#7a837b]">Tip: press <kbd className="rounded-md border border-black/10 bg-white px-1.5 py-0.5 font-medium">Ctrl K</kbd> anywhere.</div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
