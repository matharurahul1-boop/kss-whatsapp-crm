import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { AuditLog, PaginatedResult } from "@/lib/types";

export default function LogsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page],
    queryFn: () => api.get<PaginatedResult<AuditLog>>(`/settings/audit-logs?page=${page}&pageSize=20`),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Audit Logs" description="A record of key actions taken across the platform." />

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="p-5"><Skeleton className="h-64 w-full" /></div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={ScrollText} title="No activity yet" description="Actions like logins, template changes, and campaign launches will appear here." />
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
                {data.items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(log.createdAt)}</TableCell>
                    <TableCell className="text-sm">{log.user?.name ?? "System"}</TableCell>
                    <TableCell><Badge variant="outline">{log.action.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="text-sm">{log.description}</TableCell>
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
