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
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="glass border-t border-border/60 shadow-float">
        <div className="flex h-16 items-center justify-around px-1">
          {ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 touch-target transition-all duration-200",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn(
                    "flex items-center justify-center rounded-xl p-1.5 transition-all duration-200",
                    isActive && "bg-primary/10 scale-110"
                  )}>
                    <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 1.8} />
                  </span>
                  <span className={cn(
                    "text-[10px] font-medium leading-none transition-all",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}>
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="absolute top-1 h-1 w-1 rounded-full bg-primary" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
