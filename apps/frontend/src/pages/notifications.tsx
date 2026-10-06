import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, Search, Send } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Pagination } from "@/components/shared/pagination";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/utils";
import { Notification, PaginatedResult } from "@/lib/types";

export default function NotificationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), pageSize: "15" });
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", search, status, dateFrom, dateTo, page],
    queryFn: () => api.get<PaginatedResult<Notification>>(`/notifications?${params.toString()}`),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notifications"
        description="Delivery logs for all WhatsApp messages sent."
        actions={
          <Button asChild>
            <Link to="/send"><Send className="h-4 w-4" /> Send Notification</Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Phone, message ID, contact..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={status || "ALL"} onValueChange={(v) => { setStatus(v === "ALL" ? "" : v); setPage(1); }}>
          <SelectTrigger className="sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {["QUEUED", "SENT", "DELIVERED", "READ", "FAILED"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" className="sm:w-40" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        <Input type="date" className="sm:w-40" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
      </div>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="p-5"><Skeleton className="h-64 w-full" /></div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications found" description="Sent messages will appear here." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Message ID</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(n.createdAt)}</TableCell>
                    <TableCell className="text-sm">{n.contact?.name ?? "-"}</TableCell>
                    <TableCell className="font-mono text-sm">{formatPhone(n.phone)}</TableCell>
                    <TableCell className="text-sm">{n.template?.name ?? "-"}</TableCell>
                    <TableCell className="text-sm">{n.campaign?.name ?? "-"}</TableCell>
                    <TableCell className="max-w-[140px] truncate font-mono text-xs text-muted-foreground" title={n.messageId ?? ""}>{n.messageId ?? "-"}</TableCell>
                    <TableCell>
                      <StatusBadge status={n.status} />
                      {n.status === "FAILED" && n.failReason && <p className="mt-1 max-w-[180px] text-xs text-destructive">{n.failReason}</p>}
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
