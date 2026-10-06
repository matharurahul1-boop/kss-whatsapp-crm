import { NavLink } from "react-router-dom";
import { LayoutDashboard, FileText, Users, Megaphone, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/conversations", label: "Chats", icon: MessageCircle },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-border bg-card/95 backdrop-blur lg:hidden">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]", isActive ? "text-primary" : "text-muted-foreground")}
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
