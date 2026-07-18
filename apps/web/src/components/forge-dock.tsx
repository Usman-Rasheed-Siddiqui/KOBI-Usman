"use client";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Maximize2, Send, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRef, useState } from "react";
import { GenieTransition } from "./genie-transition";
import { springs } from "@/lib/motion";

export function ForgeDock() {
  const [open, setOpen] = useState(false);
  const [minimizing, setMinimizing] = useState(false);
  const [input, setInput] = useState("");
  const [reply, setReply] = useState("Ask me to find a contribution, hardware project, event, or collaborator.");
  const [busy, setBusy] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  const close = () => {
    setMinimizing(true);
    window.setTimeout(() => {
      setOpen(false);
      setMinimizing(false);
    }, 520);
  };

  const ask = async () => {
    const text = input.trim();
    if (!text) return;
    setBusy(true);
    setReply("Searching live sources and ranking matches...");
    try {
      const res = await fetch("/api/forge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setReply(data.text ?? data.error ?? "KOBI Agent could not answer right now.");
    } catch {
      setReply("KOBI Agent could not connect. Open the full workspace and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[70] hidden lg:block">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.78, y: 35, x: 45 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0 }}
            transition={springs.modal}
            className="absolute bottom-14 right-0 w-[390px] origin-bottom-right"
          >
            <GenieTransition active={minimizing} target={{ x: 160, y: 310 }} className="overflow-hidden rounded-[26px] border border-white/80 bg-[#fbfcf8] shadow-[0_28px_100px_rgba(6,25,14,.24)]">
              <div className="flex items-center justify-between border-b border-black/7 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-10 place-items-center overflow-hidden rounded-[13px] bg-[#05090b] text-white">
                    <Image src="/brand/kobi-agent-mark.png" alt="" width={40} height={40} className="size-10 object-contain" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold">KOBI Agent</div>
                    <div className="text-[10px] text-[#798279]">Grounded live discovery</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Link href="/agent" className="grid size-8 place-items-center rounded-lg hover:bg-black/5" aria-label="Open full KOBI Agent">
                    <Maximize2 className="size-3.5" />
                  </Link>
                  <button onClick={close} className="grid size-8 place-items-center rounded-lg hover:bg-black/5" aria-label="Minimize KOBI Agent">
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="min-h-48 p-4">
                <p className="whitespace-pre-wrap text-[13px] leading-6 text-[#485249]">{reply}</p>
              </div>
              <div className="border-t border-black/7 p-3">
                <form onSubmit={(event) => { event.preventDefault(); void ask(); }} className="flex items-center gap-2 rounded-[15px] border border-black/8 bg-white p-1.5 pl-3">
                  <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Find beginner React issues..." className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
                  <button disabled={busy} className="grid size-8 place-items-center rounded-[10px] bg-[#163c2d] text-white disabled:opacity-50">
                    <Send className="size-3.5" />
                  </button>
                </form>
                <Link href="/agent" className="mt-2 flex items-center justify-center gap-1 text-[11px] font-semibold text-[#416450]">
                  Open full AI workspace <ChevronRight className="size-3" />
                </Link>
              </div>
            </GenieTransition>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        ref={button}
        onClick={() => { if (open) close(); else setOpen(true); }}
        whileTap={{ scale: 0.94 }}
        whileHover={{ scale: 1.03 }}
        transition={springs.snappy}
        className="grid size-[52px] place-items-center overflow-hidden rounded-[18px] bg-[#05090b] text-white shadow-[0_14px_40px_rgba(14,55,36,.25)]"
        aria-label="Open KOBI Agent"
      >
        <Image src="/brand/kobi-agent-mark.png" alt="" width={52} height={52} className="size-[52px] object-contain" />
      </motion.button>
    </div>
  );
}
