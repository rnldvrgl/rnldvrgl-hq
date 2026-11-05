"use client";

import { Suspense, useEffect, useState, type ReactNode, type SubmitEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Fingerprint, KeyRound, Lock, Mail, MailCheck } from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemePicker } from "@/components/ThemePicker";
import { HQ, OWNER } from "@/hq.config";
import { BrandIcon } from "@/lib/brand-icon";
import { TEAM } from "@/lib/team";
import { cn } from "@/lib/utils";
import { unlock } from "@/components/SessionLock";

const ERRORS: Record<string, string> = {
  owner: "HQ only opens for its owner. Sign in with the owner's email.",
  link: "That sign-in link didn't work. Type the 6-digit code from the email instead.",
};
/** Not errors: why you're seeing the sign-in page. */
const NOTES: Record<string, string> = {
  again: "You closed HQ, so it signed you out. Sign in again.",
};

/** Turn Supabase's error codes into plain sentences. */
function friendly(message: string): string {
  if (/expired|invalid/i.test(message)) return "That code is wrong or has expired. Check the newest email, or send a new code.";
  if (/email rate limit/i.test(message)) return "Supabase's free email service only sends 2 emails an hour. Sign in with your password instead, or try a code again in an hour.";
  if (/only request this after|security purposes/i.test(message)) return "Wait 60 seconds before asking for another code.";
  if (/rate limit|too many/i.test(message)) return "Too many tries. Wait a few minutes and try again.";
  if (/invalid login credentials/i.test(message)) return "Wrong email or password.";
  if (/signups not allowed/i.test(message)) return "That email isn't registered. Use the owner's email.";
  return message;
}

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"password" | "email" | "code">("password");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const note = NOTES[params.get("note") ?? ""] ?? "";
  const [err, setErr] = useState(() => {
    const reason = params.get("reason");
    const base = ERRORS[params.get("error") ?? ""] ?? "";
    return reason ? `${base} (${reason})` : base;
  });

  // Supabase sometimes reports link errors in the URL hash, which the server never sees.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const desc = hash.get("error_description");
    if (desc) {
      setErr(`${ERRORS.link} (${desc.replace(/\+/g, " ")})`);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function sendCode(e?: SubmitEvent<HTMLFormElement>) {
    e?.preventDefault();
    setErr(""); setBusy(true);
    const { error } = await browserClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) return setErr(friendly(error.message));
    setStep("code");
  }

  async function signInWithPassword(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(""); setBusy(true);
    const { error } = await browserClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setErr(friendly(error.message));
    unlock();
    window.location.assign("/");
  }

  async function verify(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(""); setBusy(true);
    const { error } = await browserClient().auth.verifyOtp({ email, token: code.trim(), type: "email" });
    setBusy(false);
    if (error) return setErr(friendly(error.message));
    unlock();
    window.location.assign("/"); // full reload so the server sees the new session cookie
  }

  // Face ID / Touch ID / Windows Hello / a security key, once a passkey was added in Settings → Account
  const [canPasskey, setCanPasskey] = useState(false);
  useEffect(() => { setCanPasskey(typeof window !== "undefined" && "PublicKeyCredential" in window); }, []);
  async function signInWithPasskey() {
    setErr(""); setBusy(true);
    const { error } = await browserClient().auth.signInWithPasskey();
    setBusy(false);
    if (error) {
      // the person closed the prompt: not an error worth showing
      if (/abort|cancel|not allowed|NotAllowedError/i.test(error.message)) return;
      return setErr(/passkey|webauthn|credential/i.test(error.message) ? `${friendly(error.message)} Add a passkey in Settings → Account first.` : friendly(error.message));
    }
    unlock();
    window.location.assign("/");
  }

  const mode = step === "code" ? "email" : step;
  const switchTo = (next: "password" | "email") => { setStep(next); setErr(""); setCode(""); };

  const now = useNow();
  const hour = now ? Number(HOUR.format(now)) : 10;
  const phase = phaseAt(hour);
  const greet = hour < 12 && hour >= 4 ? "Good morning" : hour < 18 && hour >= 12 ? "Good afternoon" : "Good evening";
  const onDark = HQ.login.backdrop === "street" && SKY[phase].lit;

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden px-[max(16px,env(safe-area-inset-left,0px))] pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-[max(12px,env(safe-area-inset-top,0px))]">
      <Backdrop phase={phase} />

      <header className="relative z-10 flex items-center justify-between gap-3">
        <div className={cn("flex items-center gap-2.5", onDark ? "text-white" : "text-foreground")}>
          <span className="overflow-hidden rounded-xl shadow-lg ring-1 ring-white/40"><BrandIcon size={34} /></span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold">{HQ.appName}</span>
            <span className={cn("block text-[11px]", onDark ? "text-white/75" : "text-muted-foreground")}>{HQ.city.full}</span>
          </span>
        </div>
        <ThemePicker />
      </header>

      <div className="relative z-10 grid flex-1 place-items-center py-6">
        <section className="glass w-full max-w-[25rem] rounded-[1.75rem] bg-background/75 p-6 shadow-2xl [--glass-blur:28px] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <ul className="flex -space-x-1.5" aria-label="The team">
              {TEAM.map((m) => (
                <li key={m.id} title={`${m.name} · ${m.title}`} className="grid size-7 place-items-center rounded-full text-[10px] font-semibold text-white ring-2 ring-card" style={{ background: `var(--c${m.color})` }}>
                  {m.name.slice(0, 1)}
                </li>
              ))}
            </ul>
            {now && (
              <span className="whitespace-nowrap rounded-full bg-muted/70 px-2.5 py-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                {CLOCK.format(now)} · {HQ.city.name}
              </span>
            )}
          </div>

          <header className="mb-6 grid gap-1.5">
            <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{greet}, {OWNER}</h1>
            <p className="text-sm text-muted-foreground">
              {step === "code" ? <>We sent a code to <span className="font-medium text-foreground">{email}</span>.</> : HQ.login.tagline}
            </p>
          </header>

          <div className="grid gap-4">
            {canPasskey && step !== "code" && (
              <>
                <Button type="button" size="lg" className="h-12 rounded-2xl text-[15px]" disabled={busy} onClick={signInWithPasskey}>
                  <Fingerprint className="size-5" aria-hidden /> Sign in with a passkey
                </Button>
                <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
                  <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
                </div>
              </>
            )}

            {step !== "code" && (
              <div role="tablist" aria-label="How to sign in" className="grid grid-cols-2 gap-1 rounded-2xl bg-muted/60 p-1">
                {([["password", "Password", KeyRound], ["email", "Email code", Mail]] as const).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={mode === id}
                    onClick={() => switchTo(id)}
                    className={cn(
                      "inline-flex min-h-9 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-ring",
                      mode === id ? "bg-background/90 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            )}

            {step === "password" ? (
              <form onSubmit={signInWithPassword} className="grid gap-3">
                <Field id="email" label="Email">
                  <Input id="email" type="email" autoComplete="email webauthn" required value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} placeholder="you@example.com" />
                </Field>
                <Field id="password" label="Password">
                  <div className="relative">
                    <Input id="password" type={showPw ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={cn(INPUT, "pr-11")} />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      aria-pressed={showPw}
                      className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {showPw ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                    </button>
                  </div>
                </Field>
                <Button type="submit" size="lg" variant={canPasskey ? "outline" : "default"} className="mt-1 h-11 rounded-xl" disabled={busy}>
                  {busy ? "Signing in…" : <>Sign in <ArrowRight className="size-4" aria-hidden /></>}
                </Button>
              </form>
            ) : step === "email" ? (
              <form onSubmit={sendCode} className="grid gap-3">
                <Field id="email" label="Email">
                  <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} placeholder="you@example.com" />
                </Field>
                <Button type="submit" size="lg" variant={canPasskey ? "outline" : "default"} className="mt-1 h-11 rounded-xl" disabled={busy}>
                  {busy ? "Sending…" : <>Email me a 6-digit code <ArrowRight className="size-4" aria-hidden /></>}
                </Button>
                <p className="text-xs text-muted-foreground">No password needed. The code works in any browser.</p>
              </form>
            ) : (
              <form onSubmit={verify} className="grid gap-3">
                <p className="flex gap-2.5 rounded-2xl bg-muted/50 p-3 text-sm text-muted-foreground">
                  <MailCheck className="size-5 shrink-0 text-primary" aria-hidden />
                  Type the code from the email. It works in any browser, so you don&apos;t need to click the link.
                </p>
                <Field id="code" label="Code">
                  <Input
                    id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10}
                    placeholder="123456" required autoFocus value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className={cn(INPUT, "h-14 text-center font-mono text-2xl tracking-[0.45em]")}
                  />
                </Field>
                <Button type="submit" size="lg" className="mt-1 h-11 rounded-xl" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Sign in"}</Button>
                <div className="flex justify-between gap-3 text-sm">
                  <button type="button" className="text-muted-foreground underline-offset-4 hover:underline" onClick={() => { setStep("email"); setCode(""); setErr(""); }}>
                    Use a different email
                  </button>
                  <button type="button" className="text-primary underline-offset-4 hover:underline" disabled={busy} onClick={() => sendCode()}>
                    Send a new code
                  </button>
                </div>
              </form>
            )}
            {note && !err && <p className="rounded-xl border border-border bg-muted/60 px-3 py-2 text-sm text-muted-foreground" role="status">{note}</p>}
            {err && <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{err}</p>}
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <Lock className="size-3.5 shrink-0" aria-hidden /> Private office. Only {OWNER} can sign in.
          </p>
        </section>
      </div>
    </main>
  );
}

const INPUT = "h-11 rounded-xl border-border/70 bg-background/70";

/** The time now, ticking every 30 s (null on the server, so the first render matches). */
function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ the picture */

type Phase = "dawn" | "day" | "dusk" | "night";
type Sky = { top: string; bottom: string; hill: string; far: string; lit: boolean; ground: string; orbs: readonly [string, string, string] };
const SKY: Record<Phase, Sky> = {
  dawn: { top: "#f2b8a2", bottom: "#fde6cf", hill: "#9a8fa8", far: "#c7b3bd", lit: true, ground: "#7c8a6f", orbs: ["rgb(255 170 140 / .5)", "rgb(255 214 150 / .45)", "rgb(190 150 210 / .4)"] },
  day: { top: "#7fbbe6", bottom: "#dcf0fb", hill: "#6f9a86", far: "#a9c6bd", lit: false, ground: "#86a67a", orbs: ["rgb(255 255 255 / .55)", "rgb(140 200 255 / .45)", "rgb(170 230 200 / .4)"] },
  dusk: { top: "#4b3f7e", bottom: "#f19c7a", hill: "#4a4568", far: "#7a6585", lit: true, ground: "#4d5a4a", orbs: ["rgb(255 140 120 / .45)", "rgb(150 110 220 / .45)", "rgb(255 190 130 / .35)"] },
  night: { top: "#0c1730", bottom: "#24365e", hill: "#1a2742", far: "#22324f", lit: true, ground: "#1d2a2a", orbs: ["rgb(80 110 220 / .4)", "rgb(140 90 200 / .3)", "rgb(255 200 120 / .18)"] },
};

function phaseAt(hour: number): Phase {
  return hour >= 5 && hour < 7 ? "dawn" : hour >= 7 && hour < 17 ? "day" : hour >= 17 && hour < 19 ? "dusk" : "night";
}

const HOUR = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", hourCycle: "h23" });
const CLOCK = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true });

/**
 * Behind the glass card, full screen. "street" (hq.config.ts → login.backdrop): the office's street at this
 * hour in your city, with soft colour fields drifting over it. "aurora": just the colour fields, in the
 * app's colour style (light and dark).
 */
function Backdrop({ phase }: { phase: Phase }) {
  const sky = SKY[phase];
  const street = HQ.login.backdrop === "street";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background" style={street ? { background: `linear-gradient(${sky.top}, ${sky.bottom})` } : undefined}>
      {/* slightly out of focus, like a photo's background, so the glass card reads as the subject */}
      {street && <div className="absolute inset-0 scale-105 blur-[2px]"><Street sky={sky} phase={phase} /></div>}
      <span className="login-orb absolute -top-[15vmax] -left-[10vmax] size-[55vmax] rounded-full" style={{ background: street ? sky.orbs[0] : "var(--blob-a)" }} />
      <span className="login-orb absolute top-[20vh] -right-[15vmax] size-[45vmax] rounded-full [animation-delay:-8s]" style={{ background: street ? sky.orbs[1] : "var(--blob-b)" }} />
      <span className="login-orb absolute -bottom-[20vmax] left-[20vw] size-[50vmax] rounded-full [animation-delay:-15s]" style={{ background: street ? sky.orbs[2] : "var(--blob-c)" }} />
    </div>
  );
}

/** A flat little street scene: Mount Arayat in the distance, the HQ office between two shops, a jeepney. */
function Street({ sky, phase }: { sky: Sky; phase: Phase }) {
  const win = sky.lit ? "#ffd27a" : "#a7cbe2";
  const night = phase === "night";
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" aria-hidden>
      {/* sun or moon, stars at night */}
      {night
        ? <><circle cx="318" cy="64" r="14" fill="#f4efe1" /><circle cx="324" cy="60" r="12" fill={sky.top} />
            {[[40, 40], [90, 70], [150, 30], [220, 55], [260, 25], [360, 90], [190, 95]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.2" fill="#fff" opacity="0.8" />)}</>
        : <circle cx={phase === "dusk" ? 300 : phase === "dawn" ? 90 : 310} cy={phase === "day" ? 60 : 150} r="22" fill={phase === "day" ? "#fff4c9" : "#ffd29c"} opacity="0.95" />}
      {/* Mount Arayat and the far hills */}
      <path d="M0 205 L60 190 L110 198 L160 178 L210 120 L238 104 L262 118 L300 150 L340 170 L400 165 L400 300 L0 300Z" fill={sky.far} />
      <path d="M0 225 L70 210 L140 222 L220 206 L300 218 L400 204 L400 300 L0 300Z" fill={sky.hill} />
      {/* the ground and the road */}
      <rect x="0" y="246" width="400" height="54" fill={sky.ground} />
      <rect x="0" y="262" width="400" height="22" fill={night ? "#2a2f38" : "#4b5057"} />
      {Array.from({ length: 10 }, (_, i) => <rect key={i} x={10 + i * 42} y="272" width="20" height="2" fill="#f1ecd8" opacity="0.8" />)}
      {/* left shop: sari-sari */}
      <rect x="22" y="200" width="70" height="50" fill={night ? "#6b5a48" : "#f1d9a8"} />
      <rect x="22" y="196" width="70" height="6" fill="#7c4a2d" />
      <rect x="18" y="222" width="78" height="6" fill="#2563eb" transform="skewX(-12)" />
      <rect x="32" y="206" width="22" height="13" fill={win} />
      <rect x="62" y="206" width="22" height="13" fill={win} />
      {/* the HQ office: glass front, warm light, the sign */}
      <rect x="110" y="168" width="150" height="82" fill={night ? "#24303d" : "#e9edf0"} />
      <rect x="106" y="162" width="158" height="8" fill="#1f3a52" />
      {Array.from({ length: 6 }, (_, i) => <rect key={i} x={116 + i * 24} y="182" width="20" height="60" fill={win} opacity={sky.lit ? 0.95 : 0.75} />)}
      {Array.from({ length: 7 }, (_, i) => <rect key={i} x={114 + i * 24} y="180" width="2" height="64" fill="#2b3640" />)}
      <rect x="150" y="146" width="70" height="16" rx="3" fill="#1f3a52" />
      <text x="185" y="158" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="10" fontWeight="700" fill="#e7b04a" letterSpacing="2">HQ</text>
      {/* right shop: panaderia */}
      <rect x="276" y="192" width="76" height="58" fill={night ? "#5e5040" : "#f6dfa8"} />
      <rect x="276" y="188" width="76" height="6" fill="#92400e" />
      <rect x="286" y="200" width="56" height="14" fill="#78350f" />
      <text x="314" y="210" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontSize="7" fontWeight="800" fill="#fde68a">PANADERIA</text>
      <rect x="290" y="222" width="22" height="16" fill={win} />
      <rect x="318" y="222" width="22" height="16" fill={win} />
      {/* street lamps */}
      {[100, 268].map((x) => (
        <g key={x}>
          <rect x={x} y="196" width="2" height="54" fill="#2b3238" />
          <rect x={x - 6} y="194" width="10" height="3" rx="1" fill="#2b3238" />
          {sky.lit && <circle cx={x - 1} cy="198" r="9" fill="#ffd9a0" opacity="0.35" />}
        </g>
      ))}
      {/* the jeepney */}
      <g transform="translate(150 250)">
        <rect x="0" y="0" width="92" height="18" rx="2" fill="#f3f0e6" />
        <rect x="0" y="12" width="92" height="3" fill="#e11d48" />
        <rect x="0" y="15" width="92" height="2" fill="#2563eb" />
        <rect x="6" y="3" width="62" height="7" fill="#2b3138" />
        <rect x="74" y="5" width="22" height="13" rx="2" fill="#cbd5e1" />
        <rect x="-2" y="-3" width="80" height="3" fill="#9ca3af" />
        <circle cx="18" cy="20" r="5" fill="#111417" /><circle cx="80" cy="20" r="5" fill="#111417" />
        {sky.lit && <circle cx="98" cy="12" r="5" fill="#fff7df" opacity="0.9" />}
      </g>
      {/* a soft shade at the top so the text reads */}
      <rect x="0" y="0" width="400" height="300" fill="url(#shade)" />
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity={sky.lit ? 0.25 : 0} />
          <stop offset="0.45" stopColor="#000" stopOpacity="0" />
          <stop offset="0.75" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
