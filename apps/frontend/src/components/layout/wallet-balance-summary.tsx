import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { WalletSummary, formatInr } from "@/lib/billing-types";

export function WalletBalanceSummary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canOpenWallet = user?.role === "MANAGER";
  const { data, isError } = useQuery({
    queryKey: ["wallet-summary"], queryFn: () => api.get<WalletSummary>("/billing/summary"), refetchInterval: 15000,
  });
  if (isError) return <span className="text-xs text-destructive">Wallet unavailable</span>;
  const description = data ? "Total top-ups " + formatInr(data.totalTopUps) + ", used " + formatInr(data.totalUsed) + " after refunds, remaining " + formatInr(data.balance) : "Loading wallet totals";
  const content = <>
    <span className="min-w-0"><span className="block text-[10px] text-muted-foreground">Top-ups</span><span className="block truncate text-xs font-semibold">{data ? formatInr(data.totalTopUps) : "—"}</span></span>
    <span className="min-w-0"><span className="block text-[10px] text-muted-foreground">Used</span><span className="block truncate text-xs font-semibold">{data ? formatInr(data.totalUsed) : "—"}</span></span>
    <span className="min-w-0"><span className="block text-[10px] text-muted-foreground">Balance</span><span className="block truncate text-xs font-semibold text-primary">{data ? formatInr(data.balance) : "—"}</span></span>
  </>;
  const className = "wallet-summary grid min-w-0 max-w-[52vw] grid-cols-3 gap-2 rounded-xl border border-border bg-background px-2 py-1.5 text-left sm:max-w-none sm:gap-4 sm:px-3";
  return canOpenWallet
    ? <button type="button" onClick={() => navigate("/wallet")} title={description} aria-label={description} className={className + " hover:bg-accent"}>{content}</button>
    : <div role="group" title={description} aria-label={description} className={className}>{content}</div>;
}
