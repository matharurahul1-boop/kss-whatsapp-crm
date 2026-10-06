import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus, Play, Ban } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Pagination } from "@/components/shared/pagination";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Campaign, PaginatedResult } from "@/lib/types";

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), pageSize: "10" });
  if (status) params.set("status", status);

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", status, page],
    queryFn: () => api.get<PaginatedResult<Campaign>>(`/campaigns?${params.toString()}`),
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => api.post(`/campaigns/${id}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Campaign started", variant: "success" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/campaigns/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Campaign cancelled", variant: "success" });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Campaigns"
        description="Bulk WhatsApp notification campaigns for KSS Interiors."
        actions={
          <Button asChild>
            <Link to="/campaigns/new"><Plus className="h-4 w-4" /> Create Campaign</Link>
          </Button>
        }
      />

      <Select value={status || "ALL"} onValueChange={(v) => { setStatus(v === "ALL" ? "" : v); setPage(1); }}>
        <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Statuses</SelectItem>
          {["DRAFT", "SCHEDULED", "PROCESSING", "COMPLETED", "PARTIALLY_COMPLETED", "FAILED", "CANCELLED"].map((s) => (
            <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="p-5"><Skeleton className="h-64 w-full" /></div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description="Create your first campaign to send bulk WhatsApp notifications."
            action={<Button asChild className="mt-2"><Link to="/campaigns/new"><Plus className="h-4 w-4" /> Create Campaign</Link></Button>}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link to={`/campaigns/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    </TableCell>
                    <TableCell className="text-sm">{c.template?.name}</TableCell>
                    <TableCell className="text-sm">
                      {c.sentCount + c.failedCount}/{c.totalRecipients} sent &middot; {c.deliveredCount} delivered &middot; {c.failedCount} failed
                    </TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {(c.status === "DRAFT" || c.status === "SCHEDULED") && (
                          <Button variant="ghost" size="icon" title="Start" onClick={() => startMutation.mutate(c.id)}>
                            <Play className="h-4 w-4 text-success" />
                          </Button>
                        )}
                        {["DRAFT", "SCHEDULED", "PROCESSING"].includes(c.status) && (
                          <Button variant="ghost" size="icon" title="Cancel" onClick={() => cancelMutation.mutate(c.id)}>
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
