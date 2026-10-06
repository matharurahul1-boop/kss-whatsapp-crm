import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Menu, Search, LogOut, User as UserIcon, Circle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { SidebarNav } from "./sidebar";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { WhatsAppAccount } from "@/lib/types";
import { initials } from "@/lib/utils";

export function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: account } = useQuery({
    queryKey: ["whatsapp-account"],
    queryFn: () => api.get<WhatsAppAccount>("/whatsapp-account"),
    staleTime: 30000,
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
        <Menu className="h-5 w-5" />
      </Button>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="left-0 top-0 h-full w-72 max-w-[85vw] translate-x-0 translate-y-0 rounded-none p-0 sm:rounded-none">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <div className="flex h-16 items-center border-b border-border px-5 font-semibold">KSS WhatsApp</div>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="relative hidden flex-1 max-w-sm sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search contacts, templates, campaigns..."
          className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium sm:flex">
          <Circle className={`h-2 w-2 fill-current ${account?.status === "CONNECTED" ? "text-success" : "text-muted-foreground"}`} />
          {account?.status === "CONNECTED" ? "Connected" : "Not Connected"}
          <span className="text-muted-foreground">&middot; {account?.mode === "live" ? "Live" : "Mock"}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {user ? initials(user.name) : <UserIcon className="h-4 w-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.name}</DropdownMenuLabel>
            <p className="px-2 pb-1.5 text-xs text-muted-foreground">{user?.email}</p>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>Account settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
            >
              <LogOut className="h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
