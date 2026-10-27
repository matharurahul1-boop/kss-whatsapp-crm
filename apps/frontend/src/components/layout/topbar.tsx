import { WalletBalanceAlert } from "./wallet-balance-alert";
import { WalletBalanceSummary } from "./wallet-balance-summary";
import { canAccessManagerScreens } from "@/lib/permissions";
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
    <header className="app-topbar sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 rounded-[20px] border border-border/60 bg-card/90 px-3 shadow-pop backdrop-blur-xl sm:px-4 lg:rounded-3xl" style={{ boxShadow: "0 8px 28px -6px rgb(34 21 8 / 0.14), inset 0 1px 0 hsl(0 0% 100% / 0.65)" }}>
      <Button variant="ghost" size="icon" className="topbar-menu shrink-0 lg:hidden" aria-label="Open navigation menu" onClick={() => setMobileOpen(true)}>
        <Menu className="h-5 w-5" />
      </Button>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="left-3 top-3 flex h-[calc(100dvh-1.5rem)] max-h-[calc(100dvh-1.5rem)] w-72 max-w-[calc(100vw-1.5rem)] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-3xl border border-border/60 bg-card/95 p-0 shadow-float backdrop-blur-xl">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <div className="mx-3 flex h-16 shrink-0 items-center border-b border-border/50 px-2 font-semibold">KSS WhatsApp</div>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="relative hidden min-w-0 max-w-sm flex-1 xl:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search contacts, templates, campaigns..."
          className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="topbar-actions ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
        {(user?.role === "MANAGER" || user?.role === "ADMIN") && <>
          <WalletBalanceSummary key={"summary-" + user.id} />
          <WalletBalanceAlert key={"alert-" + user.id} />
        </>}
        <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium lg:flex">
          <Circle className={`h-2 w-2 fill-current ${account?.status === "CONNECTED" ? "text-success" : "text-muted-foreground"}`} />
          {account?.status === "CONNECTED" ? "Connected" : "Not Connected"}
          <span className="text-muted-foreground">&middot; {account?.mode === "live" ? "Live" : "Mock"}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="topbar-profile flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {user ? initials(user.name) : <UserIcon className="h-4 w-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.name}</DropdownMenuLabel>
            <p className="px-2 pb-1.5 text-xs text-muted-foreground">{user?.email}</p>
            <DropdownMenuSeparator />
            {canAccessManagerScreens(user?.role) && <DropdownMenuItem onClick={() => navigate("/settings")}>Account settings</DropdownMenuItem>}
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
