import { useAuth } from "@/lib/auth-context";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { LowBalanceAlert, formatInr } from "@/lib/billing-types";

export function WalletBalanceAlert() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const notified = useRef<string | null>(null);
  const { data, isError } = useQuery({ queryKey: ["balance-alert"], queryFn: () => api.get<LowBalanceAlert>("/billing/alerts"), refetchInterval: 15000 });
  useEffect(() => {
    if (!data) return;
    if (!data.active) { notified.current = null; return; }
    const key = data.walletId + ":" + data.threshold;
    if (notified.current !== key) {
      notified.current = key;
      toast({ title: "Wallet balance is low", description: formatInr(data.balance) + " available; alert limit " + formatInr(data.threshold) + ". Please arrange a top-up.", variant: "destructive" });
    }
  }, [data, toast]);
  return <DropdownMenu><DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" className="wallet-alert relative" aria-label={data?.active ? "Low wallet balance notification" : "Wallet notifications"}>
      <Bell className="h-5 w-5" />{data?.active && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />}
    </Button>
  </DropdownMenuTrigger><DropdownMenuContent align="end" className="w-72">
    <DropdownMenuLabel>Wallet notifications</DropdownMenuLabel>
    <p className="px-2 py-2 text-sm">{isError ? "Could not check wallet balance." : !data ? "Checking balance…" : data.active ? "Low balance: " + formatInr(data.balance) + ". Top-up limit: " + formatInr(data.threshold) : "No low-balance alert. Available: " + formatInr(data.balance)}</p>
    {user?.role === "MANAGER" && <DropdownMenuItem onClick={() => navigate("/wallet")}>Open Wallet & Billing</DropdownMenuItem>}
  </DropdownMenuContent></DropdownMenu>;
}
