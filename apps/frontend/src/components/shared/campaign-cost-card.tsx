import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignCost, formatInr } from "@/lib/billing-types";
export function CampaignCostCard({ data, loading, error }: { data?: CampaignCost; loading: boolean; error: boolean }) {
  return <Card><CardHeader><CardTitle>Campaign cost preview</CardTitle></CardHeader><CardContent className="flex flex-col gap-2 text-sm">
    {loading && <p>Checking recipients, category price and wallet balance…</p>}
    {error && <p className="text-destructive">Could not calculate campaign cost. Refresh before starting.</p>}
    {!error && data && <>
      <p>{data.recipients} valid recipients · {data.category} · {data.rateInr == null ? "Category price not set" : formatInr(data.rateInr) + " / message"}</p>
      <p className="font-semibold">Estimated cost: {data.estimatedCost == null ? "Unavailable" : formatInr(data.estimatedCost)}</p>
      <p>Available balance: {formatInr(data.availableBalance)}</p>
      {data.balanceAfter != null && data.canSend && <p>Estimated balance after send: {formatInr(data.balanceAfter)}</p>}
      {data.rateInr == null ? <p className="text-destructive">Ask management to set the category price before starting.</p> : data.recipients === 0 ? <p className="text-destructive">No valid pending recipients.</p> : !data.canSend && <p className="text-destructive">Top up {formatInr(data.shortfall ?? 0)} before starting this campaign.</p>}
      <p className="text-xs text-muted-foreground">Estimate at the current rate. Balance is checked again at start and for every send; other campaigns may use credit. Failed sends are refunded.</p>
    </>}
  </CardContent></Card>;
}
