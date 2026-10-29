import { useAuth } from "@/lib/auth-context";
import { canAccessManagerScreens, MANAGER_SCREEN_PATHS } from "@/lib/permissions";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, MessageCircle, FileText, Users, Send,
  Wallet, Bell, Code2, ScrollText, Settings, Megaphone, Gift, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const REFERRAL_URL = "https://referral-umber.vercel.app/";

const SPARKLES = [
  { x: -11, y: -11, size: 7, delay: 0 },
  { x: 12,  y: -9,  size: 5, delay: 90 },
  { x: 10,  y: 11,  size: 6, delay: 170 },
];

function ReferButton({ email, name }: { email?: string; name?: string }) {
  const referrerName = (typeof name === "string" && name.trim()) || (email?.split("@")[0] ?? "");
  const href = email
    ? `${REFERRAL_URL}?${new URLSearchParams({ referrerEmail: email, referrerName })}`
    : REFERRAL_URL;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Refer and earn"
      className="refer-button group relative isolate flex h-11 w-full items-center gap-2.5 overflow-hidden rounded-xl px-3 text-[13px] font-semibold text-white shadow-lg transition hover:brightness-105"
      style={{
        background: "linear-gradient(135deg, hsl(28 82% 18%) 0%, hsl(28 70% 28%) 100%)",
        boxShadow: "0 4px 16px -4px hsl(28 82% 11% / 0.50), inset 0 1px 0 hsl(0 0% 100% / 0.12)",
      }}
    >
      <span className="relative grid h-5 w-5 shrink-0 place-items-center">
        <span aria-hidden="true" className="pointer-events-none absolute inset-0">
          {SPARKLES.map((s, i) => (
            <span
              key={i}
              className="refer-sparkle"
              style={{
                "--sparkle-x": `${s.x}px`,
                "--sparkle-y": `${s.y}px`,
                "--sparkle-size": `${s.size}px`,
                "--sparkle-delay": `${s.delay}ms`,
              } as React.CSSProperties}
            />
          ))}
        </span>
        <Gift className="refer-gift h-4 w-4" />
      </span>
      <span className="truncate">Refer &amp; earn</span>
      <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-60 transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
    </a>
  );
}

const NAV_ITEMS = [
  { to: "/dashboard",       label: "Dashboard",       icon: LayoutDashboard, group: "main" },
  { to: "/conversations",   label: "Conversations",   icon: MessageCircle,   group: "main" },
  { to: "/contacts",        label: "Contacts",        icon: Users,           group: "main" },
  { to: "/campaigns",       label: "Campaigns",       icon: Megaphone,       group: "main" },
  { to: "/templates",       label: "Templates",       icon: FileText,        group: "main" },
  { to: "/send",            label: "Send Message",    icon: Send,            group: "tools" },
  { to: "/notifications",   label: "Notifications",   icon: Bell,            group: "tools" },
  { to: "/api-integration", label: "API Integration", icon: Code2,           group: "tools" },
  { to: "/logs",            label: "Logs",            icon: ScrollText,      group: "system" },
  { to: "/wallet", label: "Wallet & Billing", icon: Wallet, group: "system" },
  { to: "/settings",        label: "Settings",        icon: Settings,        group: "system" },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const visibleItems = NAV_ITEMS.filter((item) => !MANAGER_SCREEN_PATHS.includes(item.to) || canAccessManagerScreens(user?.role));
  const main   = visibleItems.filter((i) => i.group === "main");
  const tools  = visibleItems.filter((i) => i.group === "tools");
  const system = visibleItems.filter((i) => i.group === "system");

  const renderItem = (item: (typeof NAV_ITEMS)[0]) => (
    <NavLink
      key={item.to}
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )
      }
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
    </NavLink>
  );

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
      <div className="flex flex-col gap-0.5">
        <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
          Main
        </p>
        {main.map(renderItem)}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
          Tools
        </p>
        {tools.map(renderItem)}
      </div>
      <div className="mt-auto flex flex-col gap-0.5">
        <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
          System
        </p>
        {system.map(renderItem)}
      </div>
    </nav>
  );
}

export { NAV_ITEMS };

export function Sidebar() {
  const { user } = useAuth();
  return (
    <aside className="hidden w-64 shrink-0 flex-col overflow-hidden rounded-3xl border border-border/60 bg-card/90 shadow-float backdrop-blur-xl lg:flex" style={{ boxShadow: "0 10px 34px -8px rgb(34 21 8 / 0.18), inset 0 1px 0 hsl(0 0% 100% / 0.65)" }}>
      {/* Brand header */}
      <div className="mx-3 flex h-20 shrink-0 items-center gap-3 border-b border-border/50 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-primary text-primary-foreground shadow-sm" style={{ boxShadow: "0 4px 12px -2px hsl(28 82% 11% / 0.45)" }}>
          <span className="text-base font-extrabold tracking-tight">K</span>
        </div>
        <div className="leading-tight">
          <p className="text-sm font-extrabold tracking-tight text-foreground">KSS Interiors</p>
          <p className="text-[10px] font-semibold text-muted-foreground">WhatsApp CRM</p>
        </div>
      </div>

      {/* Nav fills remaining height — scrollable if needed */}
      <div className="flex min-h-0 flex-1 flex-col">
        <SidebarNav />
      </div>

      {/* Footer */}
      <div className="mx-3 shrink-0 space-y-3 border-t border-border/50 px-2 py-4">
        <ReferButton email={user?.email} name={user?.name} />
        <p className="text-[10px] text-muted-foreground/40">v1.0 · KSS Interiors, Gurgaon</p>
      </div>
    </aside>
  );
}
