"use client";

import { authClient } from "@/lib/auth-client";
import { GitBranch, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

async function applyPendingProfile() {
  const raw = localStorage.getItem("KOBI-pending-profile");
  if (!raw) return false;
  const response = await fetch("/api/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw,
  });
  if (!response.ok) return false;
  localStorage.removeItem("KOBI-pending-profile");
  return true;
}

export function LoginClient() {
  const params = useSearchParams();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!session || params.get("apply") !== "1") return;
    void applyPendingProfile().finally(() => router.replace("/profile"));
  }, [session, params, router]);

  const submit = async () => {
    setBusy(true);
    setMessage("");
    try {
      if (mode === "signup") {
        const response = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0] || "KOBI member",
          callbackURL: "/login?apply=1",
        });
        if (response.error) throw new Error(response.error.message);
        const applied = await applyPendingProfile();
        window.location.href = applied ? "/profile" : "/onboarding";
        return;
      }

      const response = await authClient.signIn.email({ email, password, callbackURL: "/login?apply=1" });
      if (response.error) throw new Error(response.error.message);
      const applied = await applyPendingProfile();
      window.location.href = applied ? "/profile" : "/";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[calc(100dvh-120px)] max-w-5xl place-items-center py-8">
      <div className="grid w-full overflow-hidden rounded-[30px] border border-black/7 bg-white shadow-[0_30px_100px_rgba(20,45,30,.11)] md:grid-cols-[.9fr_1.1fr]">
        <div className="hidden bg-[#153c2c] p-10 text-white md:block">
          <div className="text-xs font-bold uppercase tracking-[.16em] text-white/55">Your contribution identity</div>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.02] tracking-[-.055em]">Turn curiosity into proof of work.</h1>
          <p className="mt-5 text-sm leading-7 text-white/65">
            Save live opportunities, build personal radars, create a contribution passport, and let KOBI Agent learn the kinds of work you actually enjoy.
          </p>
          <div className="mt-12 space-y-3 text-sm text-white/75">
            <p>GitHub OAuth or email/password</p>
            <p>Your searches remain under your control</p>
            <p>Onboarding answers are applied after signup</p>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <div className="text-2xl font-semibold tracking-[-.045em]">{mode === "signin" ? "Welcome back" : "Create your KOBI profile"}</div>
          <p className="mt-2 text-sm text-[#737d75]">{mode === "signin" ? "Continue your contribution trail." : "Start with only the essentials. You can enrich your profile later."}</p>
          <button
            onClick={async () => { await authClient.signIn.social({ provider: "github", callbackURL: "/login?apply=1" }); }}
            className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-black/10 bg-white text-sm font-semibold shadow-sm transition hover:bg-[#f7f8f5]"
          >
            <GitBranch className="size-4" />Continue with GitHub
          </button>
          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[.12em] text-[#939a94]"><span className="h-px flex-1 bg-black/8" />or email<span className="h-px flex-1 bg-black/8" /></div>

          {mode === "signup" && (
            <label className="block">
              <span className="text-xs font-semibold">Name</span>
              <div className="mt-1.5 flex items-center gap-2 rounded-[14px] border border-black/10 px-3">
                <LockKeyhole className="size-4 text-[#8a938b]" />
                <input value={name} onChange={(event) => setName(event.target.value)} className="h-11 flex-1 outline-none" placeholder="Your name" />
              </div>
            </label>
          )}

          <label className="mt-4 block">
            <span className="text-xs font-semibold">Email</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-[14px] border border-black/10 px-3">
              <Mail className="size-4 text-[#8a938b]" />
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" className="h-11 flex-1 outline-none" placeholder="you@example.com" />
            </div>
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-semibold">Password</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-[14px] border border-black/10 px-3">
              <LockKeyhole className="size-4 text-[#8a938b]" />
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="h-11 flex-1 outline-none" placeholder="At least 10 characters" />
            </div>
          </label>

          {message && <p className="mt-4 rounded-[12px] bg-[#fff1ef] px-3 py-2 text-xs text-[#9b342a]">{message}</p>}
          <button disabled={busy || !email || !password || (mode === "signup" && !name)} onClick={() => void submit()} className="mt-5 flex h-11 w-full items-center justify-center rounded-[14px] bg-[#163c2d] text-sm font-semibold text-white disabled:opacity-40">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : mode === "signin" ? "Log in" : "Sign up"}
          </button>
          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-4 w-full text-center text-xs font-medium text-[#557060]">
            {mode === "signin" ? "New here? Sign up" : "Already have an account? Log in"}
          </button>
        </div>
      </div>
    </div>
  );
}
