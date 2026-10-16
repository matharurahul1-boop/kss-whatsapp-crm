import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, MessageCircle, FileText, Users, Send,
  Bell, Code2, ScrollText, Settings, Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  { to: "/settings",        label: "Settings",        icon: Settings,        group: "system" },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const main   = NAV_ITEMS.filter((i) => i.group === "main");
  const tools  = NAV_ITEMS.filter((i) => i.group === "tools");
  const system = NAV_ITEMS.filter((i) => i.group === "system");

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
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
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
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border/50 bg-card shadow-card lg:flex">
      {/* Brand header */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border/50 px-5">
        {/* KSS espresso logomark */}
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <MessageCircle className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight text-foreground">KSS WhatsApp</p>
          <p className="text-[10px] font-medium text-muted-foreground">KSS Interiors · CRM</p>
        </div>
      </div>

      {/* Nav fills remaining height — scrollable if needed */}
      <div className="flex min-h-0 flex-1 flex-col">
        <SidebarNav />
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border/50 px-5 py-3">
        <p className="text-[10px] text-muted-foreground/40">v1.0 · KSS Interiors, Gurgaon</p>
      </div>
    </aside>
  );
}
