import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users, Plus, Search, Upload, MoreHorizontal, Pencil, Trash2,
  CheckSquare, Square, Layers, X, ChevronDown,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { formatPhone, cn } from "@/lib/utils";
import { Contact, PaginatedResult, STAGE_LABELS, STAGE_COLORS, ContactStage } from "@/lib/types";
import { ContactFormDialog } from "./contact-form-dialog";
import { CsvImportDialog } from "./csv-import-dialog";

const ALL_STAGES = Object.keys(STAGE_LABELS) as ContactStage[];

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch]           = useState("");
  const [source, setSource]           = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [page, setPage]               = useState(1);
  const [formOpen, setFormOpen]       = useState(false);
  const [importOpen, setImportOpen]   = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStageOpen, setBulkStageOpen] = useState(false);
  const [pendingBulkStage, setPendingBulkStage] = useState<ContactStage | "">("");

  const params = new URLSearchParams({ page: String(page), pageSize: "10" });
  if (search)      params.set("search", search);
  if (source)      params.set("source", source);
  if (stageFilter) params.set("stage", stageFilter);

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", search, source, stageFilter, page],
    queryFn: () => api.get<PaginatedResult<Contact>>(`/contacts?${params.toString()}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: "Contact deleted", variant: "success" });
      setDeleteTarget(null);
    },
  });

  const bulkStageMutation = useMutation({
    mutationFn: ({ ids, stage }: { ids: string[]; stage: ContactStage }) =>
      api.post("/contacts/bulk-stage", { ids, stage }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: `${vars.ids.length} contacts moved to ${STAGE_LABELS[vars.stage]}`, variant: "success" });
      setSelectedIds(new Set());
      setBulkStageOpen(false);
      setPendingBulkStage("");
    },
    onError: () => toast({ title: "Bulk stage change failed", variant: "destructive" }),
  });

  const pageIds = data?.items.map((c) => c.id) ?? [];
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  const toggleAll = useCallback(() => {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => new Set([...prev, ...pageIds]));
    }
  }, [allPageSelected, pageIds]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkStageOpen(false);
    setPendingBulkStage("");
  };

  const applyBulkStage = () => {
    if (!pendingBulkStage) return;
    bulkStageMutation.mutate({ ids: Array.from(selectedIds), stage: pendingBulkStage });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Contacts"
        description="Manage your customer contact list for KSS Interiors."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
            <Button onClick={() => { setEditContact(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" /> New Contact
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, email..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={stageFilter || "ALL"} onValueChange={(v) => { setStageFilter(v === "ALL" ? "" : v); setPage(1); }}>
          <SelectTrigger className="sm:w-44"><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Stages</SelectItem>
            {ALL_STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={source || "ALL"} onValueChange={(v) => { setSource(v === "ALL" ? "" : v); setPage(1); }}>
          <SelectTrigger className="sm:w-40"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Sources</SelectItem>
            {["MANUAL", "CRM_API", "EXHIBITION", "WEBSITE", "IMPORT"].map((s) => (
              <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="p-5"><Skeleton className="h-64 w-full" /></div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={Users} title="No contacts found" description="Add your first contact or import a CSV file." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-4">
                    <button
                      onClick={toggleAll}
                      className="flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Select all"
                    >
                      {allPageSelected ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : somePageSelected ? (
                        <Square className="h-4 w-4 opacity-50" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="hidden sm:table-cell">Budget</TableHead>
                  <TableHead className="hidden md:table-cell">Tags</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((contact) => {
                  const isSelected = selectedIds.has(contact.id);
                  return (
                    <TableRow
                      key={contact.id}
                      className={cn(isSelected && "bg-primary/5")}
                    >
                      <TableCell className="pl-4">
                        <button
                          onClick={() => toggleOne(contact.id)}
                          className="flex items-center justify-center text-muted-foreground transition-colors hover:text-primary"
                          aria-label={`Select ${contact.name}`}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{contact.name}</p>
                        {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{formatPhone(contact.phone)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STAGE_COLORS[contact.stage ?? "ENQUIRY"]}`}>
                          {STAGE_LABELS[contact.stage ?? "ENQUIRY"]}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {contact.budget != null
                          ? contact.budget >= 100000
                            ? `₹${(contact.budget / 100000).toFixed(1)}L`
                            : `₹${(contact.budget / 1000).toFixed(0)}K`
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {contact.tags.map((t) => (
                            <Badge key={t.id} variant="secondary">{t.name}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditContact(contact); setFormOpen(true); }}>
                              <Pencil className="h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(contact)}>
                              <Trash2 className="h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
          </>
        )}
      </Card>

      {/* ── Floating Bulk Action Bar ─────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 animate-slide-up lg:bottom-6"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="glass flex min-w-[320px] items-center gap-3 rounded-2xl border border-border/60 px-4 py-3 shadow-float">
            {/* Count */}
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {selectedIds.size}
              </span>
              <span className="text-sm font-medium text-foreground">selected</span>
            </div>

            <div className="h-5 w-px bg-border/60" />

            {/* Stage picker */}
            {bulkStageOpen ? (
              <div className="flex flex-1 items-center gap-2">
                <select
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  value={pendingBulkStage}
                  onChange={(e) => setPendingBulkStage(e.target.value as ContactStage)}
                >
                  <option value="">Pick a stage…</option>
                  {ALL_STAGES.map((s) => (
                    <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!pendingBulkStage || bulkStageMutation.isPending}
                  onClick={applyBulkStage}
                  className="shrink-0"
                >
                  {bulkStageMutation.isPending ? "Applying…" : "Apply"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setBulkStageOpen(false)} className="shrink-0 px-2">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBulkStageOpen(true)}
                className="flex-1 gap-1.5"
              >
                <Layers className="h-4 w-4" />
                Change Stage
                <ChevronDown className="h-3 w-3" />
              </Button>
            )}

            <div className="h-5 w-px bg-border/60" />

            {/* Clear */}
            <button
              onClick={clearSelection}
              className="flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <ContactFormDialog open={formOpen} onOpenChange={setFormOpen} contact={editContact} />
      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete contact"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
