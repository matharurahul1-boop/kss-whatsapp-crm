import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ArrowLeft, Ban, Play } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Pagination } from "@/components/shared/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/utils";
import { Campaign, CampaignRecipient } from "@/lib/types";

const COLORS = ["#0f7a4d", "#16a34a", "#f59e0b", "#dc2626", "#94a3b8"];

interface CampaignDetailResponse {
  campaign: Campaign;
  recipients: CampaignRecipient[];
  recipientTotal: number;
  page: number;
  pageSize: number;
}

export default function CampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [recipientStatus, setRecipientStatus] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), pageSize: "15" });
  if (recipientStatus) params.set("status", recipientStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["campaign", id, recipientStatus, page],
    queryFn: () => api.get<CampaignDetailResponse>(`/campaigns/${id}?${params.toString()}`),
    refetchInterval: (q) => (q.state.data?.campaign.status === "PROCESSING" ? 3000 : false),
  });

  const startMutation = useMutation({
    mutationFn: () => api.post(`/campaigns/${id}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", id] });
      toast({ title: "Campaign started", variant: "success" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/campaigns/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", id] });
      toast({ title: "Campaign cancelled", variant: "success" });
    },
  });

  if (isLoading || !data) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  const { campaign, recipients, recipientTotal } = data;
  const pending = campaign.totalRecipients - campaign.sentCount - campaign.failedCount;
  const chartData = [
    { name: "Delivered", value: campaign.deliveredCount },
    { name: "Read", value: campaign.readCount },
    { name: "Sent (not yet delivered)", value: Math.max(0, campaign.sentCount - campaign.deliveredCount) },
    { name: "Failed", value: campaign.failedCount },
    { name: "Pending", value: Math.max(0, pending) },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={campaign.name}
        description={campaign.description ?? undefined}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/campaigns")}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {(campaign.status === "DRAFT" || campaign.status === "SCHEDULED") && (
              <Button onClick={() => startMutation.mutate()} loading={startMutation.isPending}>
                <Play className="h-4 w-4" /> Start Campaign
              </Button>
            )}
            {["DRAFT", "SCHEDULED", "PROCESSING"].includes(campaign.status) && (
              <Button variant="destructive" onClick={() => cancelMutation.mutate()} loading={cancelMutation.isPending}>
                <Ban className="h-4 w-4" /> Cancel
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={campaign.status} />
        <span className="text-sm text-muted-foreground">Template: <Link to={`/templates/${campaign.templateId}/edit`} className="text-primary hover:underline">{campaign.template?.name}</Link></span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Recipients" value={campaign.totalRecipients} />
        <StatCard label="Sent" value={campaign.sentCount} />
        <StatCard label="Delivered" value={campaign.deliveredCount} />
        <StatCard label="Failed" value={campaign.failedCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Delivery Breakdown</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recipients</CardTitle>
            <Select value={recipientStatus || "ALL"} onValueChange={(v) => { setRecipientStatus(v === "ALL" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {["PENDING", "QUEUED", "SENT", "DELIVERED", "READ", "FAILED", "SKIPPED"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Contact</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead><TableHead>Processed</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {recipients.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{r.contact.name}</TableCell>
                    <TableCell className="font-mono text-sm">{formatPhone(r.contact.phone)}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                      {r.status === "FAILED" && r.failReason && <p className="mt-1 max-w-[160px] text-xs text-destructive">{r.failReason}</p>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(r.processedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={data.page} pageSize={data.pageSize} total={recipientTotal} onPageChange={setPage} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
