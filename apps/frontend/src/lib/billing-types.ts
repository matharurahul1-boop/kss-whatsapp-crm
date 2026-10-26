export interface LowBalanceAlert { active: boolean; balance: number; threshold: number; walletId: string; }
export interface CampaignCost {
  category: string; recipients: number; rateInr: number | null; estimatedCost: number | null;
  availableBalance: number; balanceAfter: number | null; shortfall: number | null; canSend: boolean;
}
export interface BillingRow { date: string; category: string; messages: number; chargedAttempts: number; spending: number; refunds: number; netSpending: number; topUps: number; }
export interface BillingReport {
  dateFrom: string; dateTo: string; category: string; timezone: string; rows: BillingRow[];
  summary: Omit<BillingRow, "date" | "category">;
}
export const formatInr = (value: number) => "₹" + value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export interface WalletSummary { walletId: string; currency: string; totalTopUps: number; totalUsed: number; grossUsage: number; totalRefunds: number; balance: number; }
