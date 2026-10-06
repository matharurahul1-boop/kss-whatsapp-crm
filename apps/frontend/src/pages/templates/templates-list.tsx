import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, RefreshCw, Search, MoreHorizontal, Copy, Pencil, Trash2, SendHorizontal } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { PaginatedResult, WhatsAppTemplate } from "@/lib/types";

function parseRejectionReason(reason: string): string {
  try {
    const parsed = JSON.parse(reason);
    const err = parsed?.error;
    if (err) {
      return err.error_user_msg || err.error_user_title || err.message || reason;
    }
  } catch {
    // not JSON, return as-is
  }
  return reason;
}

export default function TemplatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<WhatsAppTemplate | null>(null);

  const params = new URLSearchParams({ page: String(page), pageSize: "10" });
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (category) params.set("category", category);

  const { data, isLoading } = useQuery({
    queryKey: ["templates", search, status, category, page],
    queryFn: () => api.get<PaginatedResult<WhatsAppTemplate>>(`/templates?${params.toString()}`),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post<{ updated: number }>("/templates/sync"),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Sync complete", description: `${res.updated} pending template(s) updated from Meta.`, variant: "success" });
    },
  });

  const pullMutation = useMutation({
    mutationFn: () => api.post<{ pulled: number }>("/templates/pull"),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Templates pulled", description: `${res.pulled} real template(s) imported from your WhatsApp Business Account.`, variant: "success" });
    },
    onError: () => {
      toast({ title: "Pull failed", description: "Could not fetch templates from Meta API.", variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api.post<WhatsAppTemplate>(`/templates/${id}/duplicate`),
    onSuccess: (tpl) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Template duplicated", description: `Created "${tpl.name}"`, variant: "success" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => api.post<WhatsAppTemplate>(`/templates/${id}/submit`),
    onSuccess: (tpl) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({
        title: "Submitted for approval",
        description: `"${tpl.name}" is now ${tpl.status.toLowerCase()}.`,
        variant: tpl.status === "REJECTED" ? "destructive" : "success",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Template deleted", variant: "success" });
      setDeleteTarget(null);
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Templates"
        description="Create and manage WhatsApp message templates."
        actions={
          <>
            <Button variant="outline" onClick={() => pullMutation.mutate()} loading={pullMutation.isPending}>
              <RefreshCw className="h-4 w-4" /> Pull from Meta
            </Button>
            <Button asChild>
              <Link to="/templates/new">
                <Plus className="h-4 w-4" /> New Template
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select value={status || "ALL"} onValueChange={(v) => { setStatus(v === "ALL" ? "" : v); setPage(1); }}>
          <SelectTrigger className="sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {["DRAFT", "PENDING", "APPROVED", "REJECTED", "DISABLED"].map((s) => (
              <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category || "ALL"} onValueChange={(v) => { setCategory(v === "ALL" ? "" : v); setPage(1); }}>
          <SelectTrigger className="sm:w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            {["MARKETING", "UTILITY", "AUTHENTICATION"].map((c) => (
              <SelectItem key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="p-5"><Skeleton className="h-64 w-full" /></div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No templates found"
            description="Create your first WhatsApp template to start sending notifications."
            action={<Button className="mt-2" onClick={() => navigate("/templates/new")}><Plus className="h-4 w-4" /> New Template</Button>}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <p className="font-medium">{template.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{template.body}</p>
                    </TableCell>
                    <TableCell className="text-sm">{template.category}</TableCell>
                    <TableCell className="text-sm">{template.language}</TableCell>
                    <TableCell>
                      <StatusBadge status={template.status} />
                      {template.status === "REJECTED" && template.rejectionReason && (
                        <p className="mt-1 max-w-xs text-xs text-destructive">
                          {parseRejectionReason(template.rejectionReason)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(template.updatedAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/templates/${template.id}/edit`)}>
                            <Pencil className="h-4 w-4" /> View / Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateMutation.mutate(template.id)}>
                            <Copy className="h-4 w-4" /> Duplicate
                          </DropdownMenuItem>
                          {(template.status === "DRAFT" || template.status === "REJECTED") && (
                            <DropdownMenuItem onClick={() => submitMutation.mutate(template.id)}>
                              <SendHorizontal className="h-4 w-4" /> Submit for Approval
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(template)}>
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete template"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
