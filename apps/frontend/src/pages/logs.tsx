import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, MessageCircle, CheckCheck, XCircle, Clock, Send, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/utils";
import { AuditLog, Notification, PaginatedResult } from "@/lib/types";

type Tab = "audit" | "messages";

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  QUEUED:    { label: "Queued",    icon: Clock,      cls: "bg-slate-100  text-slate-600" },
  SENT:      { label: "Sent",      icon: Send,       cls: "bg-blue-100   text-blue-700"  },
  DELIVERED: { label: "Delivered", icon: CheckCheck, cls: "bg-green-100  text-green-700" },
  READ:      { label: "Read",      icon: CheckCheck, cls: "bg-emerald-100 text-emerald-700" },
  FAILED:    { label: "Failed",    icon: XCircle,    cls: "bg-red-100    text-red-700"   },
};

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.QUEUED;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

export default function LogsPage() {
  const [tab, setTab] = useState<Tab>("messages");
  const [auditPage, setAuditPage] = useState(1);
  const [msgPage, setMsgPage] = useState(1);
  const [msgSearch, setMsgSearch] = useState("");
  const [msgStatus, setMsgStatus] = useState("");

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ["audit-logs", auditPage],
    queryFn: () => api.get<PaginatedResult<AuditLog>>(`/settings/audit-logs?page=${auditPage}&pageSize=20`),
    enabled: tab === "audit",
  });

  const msgParams = new URLSearchParams({ page: String(msgPage), pageSize: "20" });
  if (msgSearch) msgParams.set("search", msgSearch);
  if (msgStatus) msgParams.set("status", msgStatus);

  const { data: msgData, isLoading: msgLoading } = useQuery({
    queryKey: ["msg-logs", msgPage, msgSearch, msgStatus],
    queryFn: () => api.get<PaginatedResult<Notification>>(`/notifications?${msgParams}`),
    enabled: tab === "messages",
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Logs"
        description="WhatsApp delivery log and platform audit trail."
      />

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl border border-border bg-secondary/40 p-1 self-start">
        {([
          { key: "messages", label: "Message Delivery Log", icon: MessageCircle },
          { key: "audit",    label: "Audit Trail",          icon: ScrollText    },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === key
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Message Delivery Log ── */}
      {tab === "messages" && (
        <>
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, phone..."
                className="pl-9"
                value={msgSearch}
                onChange={(e) => { setMsgSearch(e.target.value); setMsgPage(1); }}
              />
            </div>
            <Select value={msgStatus || "ALL"} onValueChange={(v) => { setMsgStatus(v === "ALL" ? "" : v); setMsgPage(1); }}>
              <SelectTrigger className="sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {Object.keys(STATUS_CONFIG).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="overflow-hidden p-0">
            {msgLoading ? (
              <div className="p-5"><Skeleton className="h-64 w-full" /></div>
            ) : !msgData || msgData.items.length === 0 ? (
              <EmptyState icon={MessageCircle} title="No messages found" description="WhatsApp messages sent will appear here with delivery status." />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Delivered At</TableHead>
                      <TableHead>Fail Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {msgData.items.map((n) => (
                      <TableRow key={n.id} className={n.status === "FAILED" ? "bg-red-50/40" : ""}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(n.createdAt)}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">{n.contact?.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground font-mono">{formatPhone(n.phone)}</p>
                        </TableCell>
                        <TableCell className="text-sm">{n.template?.name ?? "—"}</TableCell>
                        <TableCell><StatusPill status={n.status} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {n.deliveredAt ? formatDate(n.deliveredAt) : n.readAt ? formatDate(n.readAt) : "—"}
                        </TableCell>
                        <TableCell>
                          {n.failReason ? (
                            <span className="inline-block max-w-xs rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 break-words">
                              {n.failReason}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Pagination page={msgData.page} pageSize={msgData.pageSize} total={msgData.total} onPageChange={setMsgPage} />
              </>
            )}
          </Card>
        </>
      )}

      {/* ── Audit Trail ── */}
      {tab === "audit" && (
        <Card className="overflow-hidden p-0">
          {auditLoading ? (
            <div className="p-5"><Skeleton className="h-64 w-full" /></div>
          ) : !auditData || auditData.items.length === 0 ? (
            <EmptyState icon={ScrollText} title="No activity yet" description="Logins, template changes, and campaign launches will appear here." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditData.items.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(log.createdAt)}</TableCell>
                      <TableCell className="text-sm">{log.user?.name ?? "System"}</TableCell>
                      <TableCell><Badge variant="outline">{log.action.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell className="text-sm">{log.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={auditData.page} pageSize={auditData.pageSize} total={auditData.total} onPageChange={setAuditPage} />
            </>
          )}
        </Card>
      )}
    </div>
  );
}
