import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api, getAuthToken } from "@/lib/api";
import { BillingReport, LowBalanceAlert, formatInr } from "@/lib/billing-types";

export function ManagerBillingPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const today = new Date(Date.now() + 19800000).toISOString().slice(0, 10);
  const [threshold, setThreshold] = useState("");
  const [dateFrom, setDateFrom] = useState(() => new Date(new Date(today + "T00:00:00Z").getTime() - 29 * 86400000).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(today);
  const [category, setCategory] = useState("ALL");
  const [exporting, setExporting] = useState<string | null>(null);
  const alert = useQuery({ queryKey: ["balance-alert"], queryFn: () => api.get<LowBalanceAlert>("/billing/alerts"), refetchInterval: 15000 });
  useEffect(() => { if (alert.data) setThreshold(String(alert.data.threshold)); }, [alert.data?.threshold]);
  const thresholdValue = Number(threshold);
  const thresholdValid = threshold.trim() !== "" && Number.isFinite(thresholdValue) && thresholdValue >= 0 && thresholdValue <= 10000000 && Math.abs(thresholdValue * 100 - Math.round(thresholdValue * 100)) < 0.000001;
  const settings = useMutation({
    mutationFn: () => api.put("/billing/alerts/settings", { threshold: thresholdValue }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["balance-alert"] }); qc.invalidateQueries({ queryKey: ["wallet"] }); toast({ title: "Low-balance limit saved", variant: "success" }); },
    onError: () => toast({ title: "Could not save alert limit", variant: "destructive" }),
  });
  const span = (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000;
  const validDates = !!dateFrom && !!dateTo && Number.isFinite(span) && span >= 0 && span < 366;
  const filters = new URLSearchParams({ dateFrom, dateTo, category });
  const report = useQuery({ queryKey: ["billing-report", dateFrom, dateTo, category], queryFn: () => api.get<BillingReport>("/billing/reports?" + filters), enabled: validDates, refetchInterval: 30000 });
  async function download(format: "xlsx" | "pdf") {
    setExporting(format);
    try {
      const token = getAuthToken();
      const response = await fetch("/api/billing/reports/export?" + filters + "&format=" + format, { credentials: "include", headers: token ? { Authorization: "Bearer " + token } : {} });
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error?.message ?? "Export failed"); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = "billing-" + dateFrom + "-to-" + dateTo + "." + format;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) { toast({ title: error instanceof Error ? error.message : "Export failed", variant: "destructive" }); }
    finally { setExporting(null); }
  }
  return <>
    <Card><CardHeader><CardTitle>Manager low-balance alerts</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">A notification appears in your bell and as an in-app alert when balance falls below this limit. Checks run every 15 seconds while the app is open. Set ₹0 to disable.</p>
      {alert.isError && <p className="text-sm text-destructive">Could not load alert settings.</p>}
      <div className="flex flex-wrap items-end gap-3"><div className="flex flex-col gap-2"><Label htmlFor="balance-limit">Alert below (₹)</Label><Input id="balance-limit" type="number" min="0" max="10000000" step="0.01" value={threshold} onChange={(event) => setThreshold(event.target.value)} /></div>
      <Button disabled={!thresholdValid || settings.isPending || !alert.data} loading={settings.isPending} onClick={() => settings.mutate()}>Save limit</Button></div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Billing reports</CardTitle></CardHeader><CardContent className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2"><Label htmlFor="billing-from">From (IST)</Label><Input id="billing-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="billing-to">To (IST, inclusive)</Label><Input id="billing-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="billing-category">Category</Label><select id="billing-category" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="ALL">All categories</option><option value="UTILITY">Utility</option><option value="MARKETING">Marketing</option><option value="AUTHENTICATION">Authentication</option><option value="UNKNOWN">Unknown / legacy</option>
        </select></div>
        <Button variant="outline" disabled={!validDates || !report.data || report.isError || !!exporting} loading={exporting === "xlsx"} onClick={() => download("xlsx")}>Export Excel</Button>
        <Button variant="outline" disabled={!validDates || !report.data || report.isError || !!exporting} loading={exporting === "pdf"} onClick={() => download("pdf")}>Export PDF</Button>
      </div>
      {!validDates && <p className="text-sm text-destructive">Choose an ordered date range of at most 366 days.</p>}
      {validDates && report.isLoading && <p className="text-sm">Loading billing report…</p>}
      {report.isError && <p className="text-sm text-destructive">Could not load this report. Check the date range and retry.</p>}
      {validDates && report.data && <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[ ["Sent messages", String(report.data.summary.messages)], ["Gross spending", formatInr(report.data.summary.spending)], ["Refunds", formatInr(report.data.summary.refunds)], ["Net spending", formatInr(report.data.summary.netSpending)], ["Top-ups", formatInr(report.data.summary.topUps)] ].map(([label, value]) => <div key={label} className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}
        </div>
        <p className="text-xs text-muted-foreground">By transaction posting date in India time. Sent = provider-accepted messages; charged attempts also include later-failed sends. Refunds appear on their posting date. Top-ups appear only for All categories. Net = gross spending − refunds.</p>
        <div className="max-h-96 overflow-auto"><Table><TableHeader><TableRow><TableHead>Date (IST)</TableHead><TableHead>Category</TableHead><TableHead>Sent</TableHead><TableHead>Attempts</TableHead><TableHead>Gross</TableHead><TableHead>Refunds</TableHead><TableHead>Net</TableHead><TableHead>Top-ups</TableHead></TableRow></TableHeader><TableBody>
          {report.data.rows.length === 0 && <TableRow><TableCell colSpan={8}>No transactions match these filters.</TableCell></TableRow>}
          {report.data.rows.map((row) => <TableRow key={row.date + row.category}><TableCell>{row.date}</TableCell><TableCell>{row.category}</TableCell><TableCell>{row.messages}</TableCell><TableCell>{row.chargedAttempts}</TableCell><TableCell>{formatInr(row.spending)}</TableCell><TableCell>{formatInr(row.refunds)}</TableCell><TableCell>{formatInr(row.netSpending)}</TableCell><TableCell>{formatInr(row.topUps)}</TableCell></TableRow>)}
        </TableBody></Table></div>
      </>}
    </CardContent></Card>
  </>;
}
