import { FormEvent, useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { ApiRequestError } from "@/lib/api";
import { cn } from "@/lib/utils";

/* ── Showcase slides ─────────────────────────────────────────────────── */
const SLIDES = [
  {
    category: "Modular Kitchen",
    tagline: "Crafted for every Indian home",
    img: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1400&q=85&fit=crop",
    accent: "#C9A96E",
  },
  {
    category: "Wardrobes",
    tagline: "Space designed around you",
    img: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1400&q=85&fit=crop",
    accent: "#B5957A",
  },
  {
    category: "Wall Paneling",
    tagline: "Textures that tell a story",
    img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1400&q=85&fit=crop",
    accent: "#A89070",
  },
  {
    category: "TV Consoles",
    tagline: "Where design meets function",
    img: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1400&q=85&fit=crop",
    accent: "#C4A882",
  },
  {
    category: "Vanities",
    tagline: "Your personal sanctuary",
    img: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1400&q=85&fit=crop",
    accent: "#BFA090",
  },
];

/* ── Animated showcase panel ─────────────────────────────────────────── */
function ShowcasePanel() {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);

  const go = (next: number) => {
    if (animating) return;
    setAnimating(true);
    setPrev(current);
    setCurrent(next);
    setTimeout(() => { setPrev(null); setAnimating(false); }, 900);
  };

  // Auto-advance every 5s
  useEffect(() => {
    const t = setInterval(() => go((current + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, [current, animating]);

  const slide = SLIDES[current];

  return (
    <div className="relative hidden h-full overflow-hidden lg:flex lg:flex-col">
      {/* ── Background images ── */}
      {SLIDES.map((s, i) => (
        <div
          key={i}
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            i === current ? "opacity-100" : "opacity-0"
          )}
          style={{
            backgroundImage: `url('${s.img}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            /* Ken Burns 3D zoom */
            animation: i === current ? "kbZoom 6s ease-in-out forwards" : "none",
          }}
        />
      ))}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/70" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />

      {/* KSS branding top-left */}
      <div className="absolute left-8 top-8 z-10 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg"
          style={{ background: slide.accent }}
        >
          <span className="text-lg font-black text-white">K</span>
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-white drop-shadow">KSS Interiors</p>
          <p className="text-[10px] text-white/70">Premium Interior Design · Gurgaon</p>
        </div>
      </div>

      {/* ── 3D floating category card ── */}
      <div className="absolute bottom-32 left-8 right-8 z-10">
        <div
          key={current}
          className="animate-slide-up"
          style={{ transformStyle: "preserve-3d", perspective: "800px" }}
        >
          {/* Thin accent line */}
          <div
            className="mb-4 h-0.5 w-12 rounded-full"
            style={{ background: slide.accent }}
          />

          {/* Category label */}
          <p
            className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-white/60"
          >
            Interior Design
          </p>
          <h2
            className="mb-2 text-4xl font-black leading-tight text-white drop-shadow-lg"
            style={{ textShadow: "0 4px 24px rgba(0,0,0,0.4)" }}
          >
            {slide.category}
          </h2>
          <p className="text-base font-medium text-white/80">{slide.tagline}</p>
        </div>
      </div>

      {/* ── Dot indicators + arrows ── */}
      <div className="absolute bottom-10 left-8 right-8 z-10 flex items-center justify-between">
        <div className="flex gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              className={cn(
                "rounded-full transition-all duration-300",
                i === current
                  ? "h-2 w-8 bg-white"
                  : "h-2 w-2 bg-white/40 hover:bg-white/60"
              )}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => go((current - 1 + SLIDES.length) % SLIDES.length)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => go((current + 1) % SLIDES.length)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Category strip (desktop) ── */}
      <div className="absolute right-0 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1 pr-4">
        {SLIDES.map((s, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-left text-xs font-semibold transition-all duration-200",
              i === current
                ? "bg-white/90 text-gray-900 shadow-lg"
                : "bg-black/20 text-white/70 backdrop-blur-sm hover:bg-white/30"
            )}
          >
            {s.category}
          </button>
        ))}
      </div>

      {/* Ken Burns keyframe */}
      <style>{`
        @keyframes kbZoom {
          0%   { transform: scale(1)    translateX(0px);  }
          50%  { transform: scale(1.06) translateX(-8px); }
          100% { transform: scale(1.04) translateX(0px);  }
        }
      `}</style>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────── */
export default function LoginPage() {
  const { user, login, signup, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">("login");

  const [loginEmail, setLoginEmail]       = useState("admin@kssinteriors.com");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupName, setSignupName]       = useState("");
  const [signupEmail, setSignupEmail]     = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");

  const [showPass, setShowPass]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!authLoading && user) return <Navigate to="/dashboard" replace />;

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!loginEmail || !loginPassword) { setError("Please enter email and password."); return; }
    setSubmitting(true);
    try { await login(loginEmail, loginPassword); navigate("/dashboard"); }
    catch (err) { setError(err instanceof ApiRequestError ? err.message : "Unable to sign in. Please try again."); }
    finally { setSubmitting(false); }
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!signupName || !signupEmail || !signupPassword) { setError("All fields are required."); return; }
    if (signupPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (signupPassword !== signupConfirm) { setError("Passwords do not match."); return; }
    setSubmitting(true);
    try { await signup(signupName, signupEmail, signupPassword); navigate("/dashboard"); }
    catch (err) { setError(err instanceof ApiRequestError ? err.message : "Unable to create account. Please try again."); }
    finally { setSubmitting(false); }
  }

  return (
    /* Full viewport — no outer scroll */
    <div className="flex h-screen overflow-hidden bg-[#F5F1EB]">

      {/* ── Left: Showcase (desktop only) ── */}
      <div className="hidden lg:block lg:w-[58%]">
        <ShowcasePanel />
      </div>

      {/* ── Right: Form panel ── */}
      <div
        className="flex w-full flex-col overflow-y-auto lg:w-[42%]"
        style={{ background: "linear-gradient(160deg, #F5F1EB 0%, #F0E2CD 100%)" }}
      >
        {/* Mobile top banner */}
        <div
          className="relative flex h-44 shrink-0 items-end overflow-hidden pb-6 pl-6 lg:hidden"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80&fit=crop')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C9A96E]">
              <span className="text-base font-black text-white">K</span>
            </div>
            <div>
              <p className="text-sm font-bold text-white">KSS Interiors</p>
              <p className="text-[10px] text-white/70">Premium Interior Design</p>
            </div>
          </div>
        </div>

        {/* Form container */}
        <div className="flex flex-1 flex-col justify-center px-7 py-8 sm:px-10 lg:px-12">

          {/* Desktop brand */}
          <div className="mb-8 hidden lg:block">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#221508]/50">
              KSS Interiors
            </p>
            <h1 className="mt-1 text-3xl font-black leading-tight text-[#221508]">
              {tab === "login" ? "Welcome back" : "Get started"}
            </h1>
            <p className="mt-1 text-sm text-[#221508]/55">
              {tab === "login"
                ? "Sign in to your CRM dashboard"
                : "Create an account to manage contacts"}
            </p>
          </div>

          {/* Mobile heading */}
          <div className="mb-6 lg:hidden">
            <h1 className="text-2xl font-black text-[#221508]">
              {tab === "login" ? "Welcome back" : "Create account"}
            </h1>
            <p className="mt-1 text-sm text-[#221508]/55">
              {tab === "login" ? "Sign in to your dashboard" : "Register to get started"}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="mb-6 flex rounded-xl border border-[#221508]/10 bg-white/60 p-1">
            {(["login", "signup"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError(null); }}
                className={cn(
                  "flex-1 rounded-lg py-2 text-sm font-semibold transition-all duration-200",
                  tab === t
                    ? "bg-[#221508] text-[#F5F1EB] shadow-sm"
                    : "text-[#221508]/50 hover:text-[#221508]"
                )}
              >
                {t === "login" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          {/* ── Login form ── */}
          {tab === "login" && (
            <form className="flex flex-col gap-4" onSubmit={handleLogin}>
              <Field label="Email address" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@kssinteriors.com"
                  className="border-[#221508]/15 bg-white/70 focus:border-[#221508]/40 focus:ring-[#221508]/10"
                />
              </Field>

              <Field label="Password" htmlFor="password">
                <PasswordInput
                  id="password"
                  value={loginPassword}
                  onChange={setLoginPassword}
                  show={showPass}
                  onToggle={() => setShowPass((s) => !s)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </Field>

              {error && <ErrorBox msg={error} />}

              <SubmitBtn loading={submitting} label="Sign in" />
            </form>
          )}

          {/* ── Signup form ── */}
          {tab === "signup" && (
            <form className="flex flex-col gap-3.5" onSubmit={handleSignup}>
              <Field label="Full name" htmlFor="sname">
                <Input
                  id="sname"
                  type="text"
                  autoComplete="name"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="Your full name"
                  className="border-[#221508]/15 bg-white/70 focus:border-[#221508]/40 focus:ring-[#221508]/10"
                />
              </Field>
              <Field label="Email address" htmlFor="semail">
                <Input
                  id="semail"
                  type="email"
                  autoComplete="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="you@kssinteriors.com"
                  className="border-[#221508]/15 bg-white/70 focus:border-[#221508]/40 focus:ring-[#221508]/10"
                />
              </Field>
              <Field label="Password" htmlFor="spass">
                <PasswordInput
                  id="spass"
                  value={signupPassword}
                  onChange={setSignupPassword}
                  show={showPass}
                  onToggle={() => setShowPass((s) => !s)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Confirm password" htmlFor="sconfirm">
                <Input
                  id="sconfirm"
                  type={showPass ? "text" : "password"}
                  autoComplete="new-password"
                  value={signupConfirm}
                  onChange={(e) => setSignupConfirm(e.target.value)}
                  placeholder="Repeat password"
                  className="border-[#221508]/15 bg-white/70 focus:border-[#221508]/40 focus:ring-[#221508]/10"
                />
              </Field>

              {error && <ErrorBox msg={error} />}

              <SubmitBtn loading={submitting} label="Create account" />
            </form>
          )}

          {/* Footer */}
          <p className="mt-8 text-center text-[11px] text-[#221508]/35">
            © {new Date().getFullYear()} KSS Interiors · Gurgaon
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Small helpers ──────────────────────────────────────────────────── */
function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-wide text-[#221508]/60">
        {label}
      </Label>
      {children}
    </div>
  );
}

function PasswordInput({
  id, value, onChange, show, onToggle, placeholder, autoComplete,
}: {
  id: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; placeholder: string; autoComplete: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-[#221508]/15 bg-white/70 pr-10 focus:border-[#221508]/40 focus:ring-[#221508]/10"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#221508]/40 hover:text-[#221508]"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">!</span>
      <p className="text-xs text-red-700">{msg}</p>
    </div>
  );
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={cn(
        "mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all duration-200",
        "bg-[#221508] text-[#F5F1EB] shadow-md hover:bg-[#3a2510] hover:shadow-lg active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-60"
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          {label}
          <ArrowRight className="h-4 w-4" />
        </>
      )}
    </button>
  );
}
