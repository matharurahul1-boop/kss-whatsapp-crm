import { NavLink } from "react-router-dom";
import { LayoutDashboard, FileText, Users, Megaphone, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/dashboard",     label: "Home",      icon: LayoutDashboard },
  { to: "/contacts",      label: "Contacts",  icon: Users },
  { to: "/conversations", label: "Chats",     icon: MessageCircle },
  { to: "/campaigns",     label: "Campaigns", icon: Megaphone },
  { to: "/templates",     label: "Templates", icon: FileText },
];

export function BottomNav() {
  return (
    <nav
      className="fixed left-3 right-3 z-40 mx-auto max-w-lg lg:hidden"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="flex items-center gap-1 overflow-hidden rounded-[26px] border border-border/60 bg-card/95 px-1.5 py-1.5 shadow-float backdrop-blur-xl">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 rounded-[20px] py-2 px-1 touch-target transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground"
              )
            }
            style={({ isActive }) =>
              isActive
                ? { boxShadow: "0 3px 12px -3px hsl(28 82% 11% / 0.55), 0 1px 4px hsl(28 82% 11% / 0.22)" }
                : undefined
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn("h-5 w-5 transition-transform duration-200", isActive && "scale-110")}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                <span
                  className={cn(
                    "text-[10px] font-bold leading-none tracking-wide transition-all",
                    isActive ? "text-primary-foreground" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
