import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  MessageCircle,
  FileText,
  Users,
  Send,
  Bell,
  Code2,
  ScrollText,
  Settings,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/whatsapp-account", label: "WhatsApp Account", icon: MessageCircle },
  { to: "/conversations", label: "Conversations", icon: Send },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/api-integration", label: "API Integration", icon: Code2 },
  { to: "/logs", label: "Logs", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export { NAV_ITEMS };

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <MessageCircle className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">KSS WhatsApp</p>
          <p className="text-[11px] text-muted-foreground">Notifications</p>
        </div>
      </div>
      <SidebarNav />
    </aside>
  );
}
