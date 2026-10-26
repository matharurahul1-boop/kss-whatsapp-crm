import { ManagerBillingPanel } from "@/components/shared/manager-billing-panel";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wallet, Plus, TrendingDown, TrendingUp,
  AlertTriangle, Users, Shield,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface WalletData {
  wallet: { id: string; balance: number; currency: string; updatedAt: string; lowBalanceThreshold: number };
  transactions: WalletTx[];
  rates: CategoryRate[];
}

interface CategoryRate { category: "UTILITY" | "MARKETING" | "AUTHENTICATION"; rateInr: number | null; }
const categoryLabel = { UTILITY: "Utility", MARKETING: "Marketing", AUTHENTICATION: "Authentication" };

interface WalletTx {
  id: string;
  type: "TOPUP" | "DEBIT" | "REFUND";
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

interface TxPage {
  items: WalletTx[];
  total: number;
  page: number;
  pageSize: number;
}

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "AGENT";
}


export default function WalletPage() {
  const { user } = useAuth();
  const canManage = user?.role === "MANAGER";
  const qc = useQueryClient();
  const { toast } = useToast();

  const [topUpOpen, setTopUpOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpNote, setTopUpNote] = useState("");
  const [txPage, setTxPage] = useState(1);
  const [ratesOpen, setRatesOpen] = useState(false);
  const [draftRates, setDraftRates] = useState<{ category: CategoryRate["category"]; value: string }[]>([]);

  const { data, isLoading } = useQuery({
    refetchInterval: 15000,
    queryKey: ["wallet"],
    queryFn: () => api.get<WalletData>("/wallet"),
  });

  const { data: txData } = useQuery({
    refetchInterval: 15000,
    queryKey: ["wallet-transactions", txPage],
    queryFn: () => api.get<TxPage>(`/wallet/transactions?page=${txPage}&pageSize=15`),
  });

  const { data: users } = useQuery({
    queryKey: ["wallet-users"],
    queryFn: () => api.get<AppUser[]>("/wallet/users"),
    enabled: usersOpen && user?.role === "ADMIN",
  });

  const topUpMutation = useMutation({
    mutationFn: () => api.post("/wallet/topup", { amount: parseFloat(topUpAmount), note: topUpNote || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["wallet-transactions"] });
      qc.invalidateQueries({ queryKey: ["balance-alert"] });
      qc.invalidateQueries({ queryKey: ["wallet-summary"] });
      qc.invalidateQueries({ queryKey: ["billing-report"] });
      toast({ title: `₹${topUpAmount} added to wallet`, variant: "success" });
      setTopUpOpen(false);
      setTopUpAmount("");
      setTopUpNote("");
    },
    onError: () => toast({ title: "Top-up failed", variant: "destructive" }),
  });

  const ratesMutation = useMutation({
    mutationFn: () => api.put("/wallet/rates", draftRates.map((rate) => ({ category: rate.category, rateInr: Number(rate.value) }))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      toast({ title: "Category prices updated", variant: "success" });
      setRatesOpen(false);
    },
    onError: () => toast({ title: "Could not save category prices", variant: "destructive" }),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.put(`/wallet/users/${id}/role`, { role }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["wallet-users"] });
      toast({ title: `Role updated to ${vars.role}`, variant: "success" });
    },
    onError: () => toast({ title: "Failed to update role", variant: "destructive" }),
  });

  const wallet = data?.wallet;
  const rates = data?.rates ?? [];
  const validRates = draftRates.length === 3 && draftRates.every((rate) => { const value = Number(rate.value); return rate.value.trim() !== "" && Number.isFinite(value) && value >= 0 && value <= 100000 && Math.abs(value * 10000 - Math.round(value * 10000)) < 0.000001; });
  const recentTx = data?.transactions ?? [];
  const isLow = wallet && wallet.balance < wallet.lowBalanceThreshold;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Wallet & Billing"
        description="Manage WhatsApp message credit balance and per-message rates."
        actions={canManage ? (
          <>
            {user?.role === "ADMIN" && <Button variant="outline" onClick={() => setUsersOpen(true)}>
              <Users className="h-4 w-4" /> Manage Users
            </Button>}
            <Button onClick={() => setTopUpOpen(true)}>
              <Plus className="h-4 w-4" /> Top Up
            </Button>
          </>
        ) : undefined}
      />

      {/* Balance card */}
      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : (
        <Card className={`overflow-hidden ${isLow ? "border-destructive/50" : ""}`}>
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl ${isLow ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
              >
                <Wallet className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Available Balance</p>
                <p className={`text-4xl font-bold ${isLow ? "text-destructive" : "text-foreground"}`}>
                  ₹{wallet?.balance.toFixed(2) ?? "0.00"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Deducted using the template’s category price
                </p>
              </div>
            </div>

            {isLow && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Low balance! Top up to continue sending messages.
              </div>
            )}

            {canManage && <div className="flex gap-3">
              <Button size="sm" onClick={() => setTopUpOpen(true)}>
                <Plus className="h-4 w-4" /> Top Up
              </Button>
            </div>}
          </CardContent>
        </Card>
      )}

      <Card><CardHeader><CardTitle>Category prices</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">One price per category applies to all its templates, with or without images or other media. Prices are configured in this software.</p>
        {canManage && <Button variant="outline" disabled={rates.length !== 3} onClick={() => { setDraftRates(rates.map((rate) => ({ category: rate.category, value: rate.rateInr == null ? "" : String(rate.rateInr) }))); setRatesOpen(true); }}>Configure category prices</Button>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {rates.map((rate) => <div key={rate.category} className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">{categoryLabel[rate.category]}</p>
            <p className="text-sm">{rate.rateInr == null ? "Price not set — sending blocked" : "₹" + rate.rateInr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + " / message"}</p>
            {wallet && rate.rateInr != null && rate.rateInr > 0 && <p className="text-xs text-muted-foreground">~{Math.floor(wallet.balance / rate.rateInr)} sends remaining</p>}
          </div>)}
        </div>
      </CardContent></Card>
      <Dialog open={ratesOpen} onOpenChange={setRatesOpen}><DialogContent>
        <DialogHeader><DialogTitle>Category prices per message</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">₹0.85 means 85 paise. New prices apply to future sends; previous charges stay unchanged.</p>
        {draftRates.map((rate, index) => <div key={rate.category} className="flex flex-col gap-2">
          <Label htmlFor={"rate-" + rate.category}>{categoryLabel[rate.category]} (₹)</Label>
          <Input id={"rate-" + rate.category} type="number" min="0" max="100000" step="0.0001" value={rate.value} onChange={(event) => setDraftRates((current) => current.map((item, i) => i === index ? { ...item, value: event.target.value } : item))} />
        </div>)}
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button disabled={!validRates || ratesMutation.isPending} loading={ratesMutation.isPending} onClick={() => ratesMutation.mutate()}>Save prices</Button></DialogFooter>
      </DialogContent></Dialog>

      {user?.role === "MANAGER" && <ManagerBillingPanel />}

      {/* Transaction history */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 p-0">
          {(txData?.items ?? recentTx).length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No transactions yet.</p>
          )}
          {(txData?.items ?? recentTx).map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 border-t border-border px-5 py-3 first:border-t-0">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tx.type !== "DEBIT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
              >
                {tx.type !== "DEBIT" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{tx.description}</p>
                <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${tx.type !== "DEBIT" ? "text-green-700" : "text-red-600"}`}>
                  {tx.type !== "DEBIT" ? "+" : ""}₹{Math.abs(tx.amount).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Bal: ₹{tx.balanceAfter.toFixed(2)}</p>
              </div>
            </div>
          ))}

          {/* Pagination for full history */}
          {txData && txData.total > txData.pageSize && (
            <div className="flex items-center justify-center gap-3 border-t border-border py-3">
              <Button variant="outline" size="sm" disabled={txPage <= 1} onClick={() => setTxPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {txData.page} of {Math.ceil(txData.total / txData.pageSize)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={txPage >= Math.ceil(txData.total / txData.pageSize)}
                onClick={() => setTxPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Top-Up Dialog ── */}
      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Balance</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 2000"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
              />
              {topUpAmount && (
                <p className="text-xs text-muted-foreground">
                  Messages available depend on the category price
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Note (optional)</Label>
              <Input placeholder="e.g. October top-up" value={topUpNote} onChange={(e) => setTopUpNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              disabled={!topUpAmount || parseFloat(topUpAmount) <= 0 || topUpMutation.isPending}
              loading={topUpMutation.isPending}
              onClick={() => topUpMutation.mutate()}
            >
              Add ₹{topUpAmount || "0"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Users / Role Management Dialog ── */}
      <Dialog open={usersOpen} onOpenChange={setUsersOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" /> User Role Management
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {!users && <Skeleton className="h-32 w-full" />}
            {users?.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <select
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  value={u.role}
                  onChange={(e) => roleMutation.mutate({ id: u.id, role: e.target.value })}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="AGENT">Agent</option>
                </select>
              </div>
            ))}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
