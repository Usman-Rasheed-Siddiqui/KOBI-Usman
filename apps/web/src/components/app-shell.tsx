"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Archive, Bookmark, CalendarDays, Home, Search, UserRound, GitPullRequest } from "lucide-react";
import { Logo } from "./logo";
import { CommandPalette } from "./command-palette";
import { ForgeDock } from "./forge-dock";
import { NotificationCenter } from "./notification-center";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";

const nav = [
  { href: "/", label: "Discover", icon: Home },
  { href: "/pulse", label: "Pulse", icon: CalendarDays },
  { href: "/forge", label: "Forge", icon: GitPullRequest },
  { href: "/pulse/collection", label: "Pulse Collection", icon: Archive },
  { href: "/forge/collection", label: "Forge Collection", icon: Archive },
  { href: "/agent", label: "Agent", icon: null },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/profile", label: "Profile", icon: UserRound, auth: true },
];

function AgentIcon({ className = "size-[18px]" }: { className?: string }) {
  return <Image src="/brand/kobi-agent-mark.png" alt="" width={36} height={36} className={cn("object-contain", className)} />;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { data: session } = authClient.useSession();
  const navItems = nav.filter((item) => !item.auth || session);
  return (
    <div className="min-h-dvh">
      <header className="glass fixed inset-x-0 top-0 z-50 h-[66px] border-x-0 border-t-0">
        <div className="mx-auto flex h-full max-w-[1500px] items-center gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="ml-3 hidden min-w-0 flex-1 items-center gap-1 xl:flex">
            {navItems.map(({ href, label }) => (
              <Link key={href} href={href} className={cn("focus-ring rounded-xl px-3 py-2 text-[13px] font-medium text-[#657067] transition hover:bg-black/[.045] hover:text-[#111712]", path === href && "bg-black/[.055] text-[#111712]")}>{label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <NotificationCenter />
            <button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))} className="hidden h-9 items-center gap-2 rounded-xl border border-black/8 bg-white/70 px-3 text-xs text-[#667067] shadow-sm transition hover:bg-white md:flex">
              <Search className="size-3.5" />Search <span className="ml-2 rounded-md bg-black/[.055] px-1.5 py-0.5 text-[10px]">Ctrl K</span>
            </button>
            {session ? (
              <Link href="/profile" className="hidden h-9 items-center gap-2 rounded-xl bg-[#163c2d] px-3 text-xs font-semibold text-white shadow-sm md:flex">
                <UserRound className="size-3.5" />Profile
              </Link>
            ) : (
              <div className="hidden items-center gap-1.5 md:flex">
                <Link href="/login?mode=signin" className="h-9 rounded-xl px-3 py-2 text-xs font-semibold text-[#4f5b52] hover:bg-black/[.045]">Log in</Link>
                <Link href="/login?mode=signup" className="h-9 rounded-xl bg-[#163c2d] px-3 py-2 text-xs font-semibold text-white shadow-sm">Sign up</Link>
              </div>
            )}
            <Link href="/agent" className="focus-ring grid size-9 place-items-center overflow-hidden rounded-xl bg-[#05090b] text-white shadow-sm xl:hidden" aria-label="Open KOBI Agent">
              <AgentIcon className="size-9" />
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1500px] px-3 pb-24 pt-[82px] sm:px-6 lg:pb-8">{children}</div>
      {path !== "/agent" && (
        <nav className="glass fixed inset-x-2 bottom-2 z-50 grid grid-cols-5 rounded-[22px] p-1.5 shadow-[0_18px_70px_rgba(5,20,12,.18)] lg:hidden">
          {[
            { href: "/", label: "Discover", icon: Home },
            { href: "/pulse", label: "Pulse", icon: CalendarDays },
            { href: "/forge", label: "Forge", icon: GitPullRequest },
            { href: "/agent", label: "Agent", icon: null },
            session ? { href: "/profile", label: "Profile", icon: UserRound } : { href: "/login?mode=signin", label: "Log in", icon: UserRound },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={cn("focus-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-[16px] text-[10px] font-medium text-[#697169] transition", path === href && "bg-[#eaf3ed] text-[#163c2d]")}>
              {Icon ? <Icon className="size-[18px]" /> : <AgentIcon />}
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      )}
      <CommandPalette />
      <ForgeDock />
    </div>
  );
}
