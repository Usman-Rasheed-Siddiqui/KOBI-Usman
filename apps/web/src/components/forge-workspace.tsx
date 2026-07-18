"use client";
import type { Opportunity } from "@openforge/domain";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronRight, LoaderCircle, MessageCircle, Search, Send, Sparkles, Wrench, Zap } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { OpportunityCard } from "./opportunity-card";
import { springs } from "@/lib/motion";

type ToolEvent = { tool: string; status: "started" | "completed" | "failed"; detail?: string };
type Message = {
  role: "user" | "assistant";
  text: string;
  opportunities?: Opportunity[];
  events?: ToolEvent[];
  suggestedActions?: string[];
  responseKind?: "conversation" | "explanation" | "search" | "results" | "detail" | "plan";
};
type AgentContext = {
  conversationId?: string;
  lastIntent?: Record<string, unknown>;
  lastResults?: Array<{ id: string; title: string; entityType: string; url: string; source: string; technologies?: string[]; topics?: string[] }>;
  resultPool?: Opportunity[];
  shownResultIds?: string[];
  shownResultKeys?: string[];
  resultCursor?: number;
  selectedId?: string;
  lastRoute?: string;
};

const prompts = [
  "How are you?",
  "Find AI events in Karachi next month.",
  "Find beginner React contribution issues.",
  "What can KOBI help me with?",
];

export function ForgeWorkspace() {
  const params = useSearchParams();
  const [input, setInput] = useState(params.get("q") ?? "");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      responseKind: "conversation",
      text: "Tell me what you want to discover. I can chat normally, search KOBI Pulse for events, search KOBI Forge for contribution opportunities, show more without repeats, broaden a search, or build a plan for a result.",
      suggestedActions: ["Find AI events", "Find React contributions", "What can KOBI help me with?"],
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [agentContext, setAgentContext] = useState<AgentContext>({});

  const send = async (text = input) => {
    const q = text.trim();
    if (!q || busy) return;
    const history = messages.filter((message) => message.text.trim()).slice(-12).map((message) => ({ role: message.role, text: message.text }));
    setInput("");
    setBusy(true);
    setMessages((current) => [...current, { role: "user", text: q }, { role: "assistant", text: "", responseKind: "search", events: [{ tool: "understand_intent", status: "started", detail: "Reading your request and current result context" }] }]);
    try {
      const res = await fetch("/api/forge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: q, history, context: agentContext }),
      });
      const data = await res.json();
      if (data.context) setAgentContext(data.context);
      const opportunities = dedupeOpportunities(data.opportunities ?? []);
      setMessages((current) => [...current.slice(0, -1), {
        role: "assistant",
        text: data.text ?? data.error ?? "KOBI Agent could not complete that request.",
        opportunities,
        events: data.events ?? [],
        suggestedActions: data.suggestedActions ?? [],
        responseKind: data.responseKind ?? "conversation",
      }]);
    } catch {
      setMessages((current) => [...current.slice(0, -1), { role: "assistant", responseKind: "conversation", text: "I could not reach the discovery service. Try again or use the direct search page." }]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const q = params.get("q");
    if (q) void send(q);
  }, []);

  return (
    <div className="grid min-h-[calc(100dvh-100px)] gap-4 pb-24 lg:pb-0 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="surface flex min-h-[560px] flex-col overflow-hidden rounded-[28px] sm:min-h-[680px]">
        <header className="flex items-center justify-between border-b border-black/7 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-[16px] bg-[#05090b] text-white shadow-[0_10px_30px_rgba(6,14,18,.18)]">
              <Image src="/brand/kobi-agent-mark.png" alt="" width={48} height={48} className="size-12 object-contain" priority />
            </span>
            <div className="min-w-0">
              <h1 className="font-semibold tracking-[-.03em]">KOBI Agent</h1>
              <p className="truncate text-xs text-[#778079]">Conversation first. Tools only when discovery is needed.</p>
            </div>
          </div>
          <span className="hidden rounded-full border border-[#b7d8c1] bg-[#eaf6ed] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.1em] text-[#286246] sm:inline-flex">Grounded tools</span>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {messages.map((message, index) => (
            <motion.div key={index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={springs.snappy} className={message.role === "user" ? "ml-auto max-w-xl" : "max-w-4xl"}>
              {message.role === "user" ? (
                <div className="rounded-[20px] rounded-br-[7px] bg-[#163c2d] px-4 py-3 text-sm leading-6 text-white shadow-sm">{message.text}</div>
              ) : (
                <AssistantMessage message={message} busy={busy && index === messages.length - 1} onAction={(action) => void send(action)} />
              )}
            </motion.div>
          ))}
        </div>

        <div className="border-t border-black/7 bg-[#fafbf7] p-3 sm:p-4">
          <div className="mb-2 flex gap-2 overflow-x-auto scrollbar-none">
            {prompts.map((prompt) => <button key={prompt} onClick={() => void send(prompt)} className="focus-ring shrink-0 rounded-full border border-black/7 bg-white px-3 py-2 text-[11px] text-[#637067] transition hover:bg-[#f4f6f2]">{prompt}</button>)}
          </div>
          <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="flex items-end gap-2 rounded-[18px] border border-black/8 bg-white p-2 pl-4 shadow-sm">
            <textarea rows={1} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Ask KOBI to find events, issues, projects, or explain a result..." className="max-h-36 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm outline-none" />
            <button disabled={busy || !input.trim()} className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-[#163c2d] text-white transition hover:bg-[#1d503b] disabled:opacity-40">
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="surface rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold"><Wrench className="size-4" />Agent boundaries</div>
          <div className="mt-4 space-y-2 text-xs leading-5 text-[#657068]">
            {["Normal chat does not invoke tools.", "Event searches stay in KOBI Pulse.", "Contribution searches stay in KOBI Forge.", "Show More uses the current ranked context.", "Plan Mode is generated from the selected result."].map((item) => (
              <div key={item} className="flex items-start gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-[#2c6b4d]" />{item}</div>
            ))}
          </div>
        </div>
        <div className="rounded-[24px] border border-[#bdd9c5] bg-[#eaf5ed] p-5">
          <div className="text-sm font-semibold text-[#234e38]">Controlled discovery.</div>
          <p className="mt-2 text-xs leading-5 text-[#496754]">KOBI shows a small first set, keeps the rest in context, and saves valid discoveries so future searches get faster.</p>
          <a href="/discover" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#234e38]">Use universal Discover <ChevronRight className="size-3" /></a>
        </div>
      </aside>
    </div>
  );
}

function normalizedResultKey(item: Opportunity) {
  const url = item.contributionUrl ?? item.registrationUrl ?? item.repositoryUrl ?? item.canonicalUrl;
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "").toLowerCase()}${parsed.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return `${item.entityType}:${item.source}:${item.title}`.toLowerCase().replace(/\s+/g, " ").trim();
  }
}

function dedupeOpportunities(items: Opportunity[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizedResultKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function AssistantMessage({ message, busy, onAction }: { message: Message; busy: boolean; onAction: (action: string) => void }) {
  const hasResults = Boolean(message.opportunities?.length);
  return (
    <div className="rounded-[24px] border border-black/7 bg-white/70 p-4 shadow-[0_16px_60px_rgba(35,65,47,.08)] sm:p-5">
      <div className="flex gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[13px] bg-[#e7f3ea] text-[#275c42]">
          {message.responseKind === "conversation" ? <MessageCircle className="size-4" /> : message.responseKind === "plan" ? <Sparkles className="size-4" /> : <Search className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <AgentText text={message.text} busy={busy && !message.text} />
          <ActivityPanel events={message.events ?? []} />
        </div>
      </div>

      {hasResults && (
        <div className="mt-4 border-t border-black/7 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[.14em] text-[#728076]">Curated first set</div>
              <p className="mt-1 text-xs text-[#687168]">Use Show More for the next batch without repeats.</p>
            </div>
            <span className="rounded-full bg-[#edf4ee] px-2.5 py-1 text-[10px] font-semibold text-[#315b43]">{message.opportunities!.length} shown</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {message.opportunities!.map((opportunity) => (
                <motion.div key={opportunity.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={springs.snappy}>
                  <OpportunityCard item={opportunity} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {message.suggestedActions?.length ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-black/7 pt-4">
          {message.suggestedActions.slice(0, 4).map((action) => (
            <button key={action} onClick={() => onAction(action)} className="focus-ring inline-flex h-9 items-center gap-2 rounded-full border border-black/8 bg-white px-3 text-xs font-semibold text-[#445047] transition hover:bg-[#f3f6f2]">
              {action.toLowerCase().includes("hard") ? <Zap className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              {action}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AgentText({ text, busy }: { text: string; busy: boolean }) {
  if (busy) {
    return <div className="space-y-3"><div className="inline-flex items-center gap-2 text-sm text-[#718078]"><LoaderCircle className="size-4 animate-spin" />KOBI is deciding whether tools are needed...</div><div className="skeleton h-4 w-2/3 rounded-full" /><div className="skeleton h-4 w-[86%] rounded-full" /></div>;
  }
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return (
    <div className="space-y-3 text-[14px] leading-7 text-[#374039]">
      {blocks.map((block, index) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const numbered = lines.filter((line) => /^\d+\.\s+/.test(line));
        if (numbered.length >= 2) {
          return <ol key={index} className="space-y-1.5 pl-5">{numbered.map((line) => <li key={line} className="list-decimal">{line.replace(/^\d+\.\s+/, "")}</li>)}</ol>;
        }
        if (lines.length > 1) {
          return <div key={index}><div className="text-sm font-semibold tracking-[-.02em] text-[#223328]">{lines[0]}</div><p className="mt-1 text-[#465148]">{lines.slice(1).join(" ")}</p></div>;
        }
        return <p key={index}>{block}</p>;
      })}
    </div>
  );
}

function ActivityPanel({ events }: { events: ToolEvent[] }) {
  if (!events.length) return null;
  const failed = events.filter((event) => event.status === "failed");
  const active = events.some((event) => event.status === "started");
  const completed = events.filter((event) => event.status === "completed");
  const visible = [...failed, ...completed].slice(-4);
  return (
    <div className="mt-4 rounded-[18px] border border-black/7 bg-[#f8faf6] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#536058]">
          {active ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5 text-[#2c6b4d]" />}
          {active ? "Search activity" : "Activity complete"}
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#879088]">{completed.length}/{events.length} steps</span>
      </div>
      {visible.length ? (
        <div className="mt-2 space-y-1.5">
          {visible.map((event, index) => (
            <div key={`${event.tool}-${index}`} className="flex items-center gap-2 text-[11px] text-[#6b746d]">
              <span className={event.status === "failed" ? "size-1.5 rounded-full bg-[#a56038]" : "size-1.5 rounded-full bg-[#4c8b65]"} />
              <span className="font-medium">{event.tool.replaceAll("_", " ")}</span>
              {event.detail && <span className="truncate text-[#8a928b]">{event.detail}</span>}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
