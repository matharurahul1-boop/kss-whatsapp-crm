import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CampaignCost, formatInr } from "@/lib/billing-types";
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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { api, ApiRequestError } from "@/lib/api";
import { formatPhone, cn } from "@/lib/utils";
import { Contact, PaginatedResult, STAGE_LABELS, STAGE_COLORS, ContactStage } from "@/lib/types";
import { ContactFormDialog } from "./contact-form-dialog";
import { CsvImportDialog } from "./csv-import-dialog";

interface BulkStagePreview {
  selected: number; changed: number; unchanged: number; invalidPhones: number; messagesToSend: number;
  templateName: string | null; automationEnabled: boolean; cost: CampaignCost | null; canApply: boolean; problem: string | null;
}
interface BulkStageResult {
  updated: number; unchanged: number; sent: number; failed: number; skipped: number; templateName?: string | null;
  results: { contactId: string; name: string; status: "SENT" | "FAILED"; reason?: string }[];
}

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
  const [bulkResult, setBulkResult] = useState<BulkStageResult | null>(null);

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

  const selectedKey = Array.from(selectedIds).sort();
  const bulkPreview = useQuery({
    queryKey: ["bulk-stage-preview", pendingBulkStage, selectedKey],
    queryFn: () => api.post<BulkStagePreview>("/contacts/bulk-stage/preview", { ids: selectedKey, stage: pendingBulkStage }),
    enabled: bulkStageOpen && !!pendingBulkStage && selectedIds.size > 0 && selectedIds.size <= 200,
    refetchInterval: bulkStageOpen ? 15000 : false,
  });

  const bulkStageMutation = useMutation({
    mutationFn: ({ ids, stage }: { ids: string[]; stage: ContactStage }) =>
      api.post<BulkStageResult>("/contacts/bulk-stage", { ids, stage }),
    onSuccess: (result, vars) => {
      for (const key of ["contacts", "dashboard-summary", "delivery-overview", "stage-funnel", "notifications", "conversations", "wallet", "wallet-summary", "balance-alert", "billing-report"]) queryClient.invalidateQueries({ queryKey: [key] });
      setBulkResult(result);
      toast({ title: result.updated + " contacts moved to " + STAGE_LABELS[vars.stage], description: result.sent + " messages sent; " + result.failed + " failed; " + result.unchanged + " already in this stage.", variant: result.failed ? "destructive" : "success" });
      setSelectedIds(new Set());
      setBulkStageOpen(false);
      setPendingBulkStage("");
    },
    onError: (error) => { bulkPreview.refetch(); toast({ title: error instanceof ApiRequestError ? error.message : "Could not complete the bulk update. Refresh contacts and notifications before retrying.", variant: "destructive" }); },
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
      if (new Set([...selectedIds, ...pageIds]).size > 200) { toast({ title: "Select up to 200 contacts per batch", variant: "destructive" }); return; }
      setSelectedIds((prev) => new Set([...prev, ...pageIds]));
    }
  }, [allPageSelected, pageIds, selectedIds, toast]);

  const toggleOne = useCallback((id: string) => {
    if (!selectedIds.has(id) && selectedIds.size >= 200) { toast({ title: "Select up to 200 contacts per batch", variant: "destructive" }); return; }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, [selectedIds, toast]);

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkStageOpen(false);
    setPendingBulkStage("");
  };

  const applyBulkStage = () => {
    if (!pendingBulkStage || !bulkPreview.data?.canApply || bulkPreview.isFetching || bulkStageMutation.isPending) return;
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

      {bulkResult && <Card><CardHeader><CardTitle>Bulk stage update result</CardTitle></CardHeader><CardContent className="flex flex-col gap-2 text-sm">
        <p>{bulkResult.updated} stages updated · {bulkResult.unchanged} already in this stage · {bulkResult.sent} sent · {bulkResult.failed} failed · {bulkResult.skipped} without a message</p>
        {bulkResult.templateName && <p>Template: {bulkResult.templateName}</p>}
        {bulkResult.failed > 0 && <p className="text-destructive">Stages were updated, but some messages failed. Review the failures below; applying the same stage again will not resend messages.</p>}
        <ul className="max-h-48 overflow-auto">{bulkResult.results.filter((result) => result.status === "FAILED").map((result) => <li key={result.contactId}>{result.name}: {result.reason}</li>)}</ul>
        <Button variant="ghost" size="sm" onClick={() => setBulkResult(null)}>Dismiss result</Button>
      </CardContent></Card>}

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
      <Card className="min-w-0 max-w-full overflow-hidden p-0">
        {isLoading ? (
          <div className="p-5"><Skeleton className="h-64 w-full" /></div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={Users} title="No contacts found" description="Add your first contact or import a CSV file." />
        ) : (
          <>
            <Table className="table-fixed sm:table-auto">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 px-2 sm:pl-4">
                    <button
                      onClick={toggleAll}
                      className="flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Select all contacts on this page"
                      aria-pressed={allPageSelected}
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
                  <TableHead className="px-3 sm:px-4">Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Phone</TableHead>
                  <TableHead className="w-24 px-2 sm:w-auto sm:px-4">Stage</TableHead>
                  <TableHead className="hidden sm:table-cell">Budget</TableHead>
                  <TableHead className="hidden md:table-cell">Tags</TableHead>
                  <TableHead className="w-12 px-1 text-right sm:w-auto sm:px-4"><span className="sr-only sm:not-sr-only">Actions</span></TableHead>
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
                      <TableCell className="px-2 sm:pl-4">
                        <button
                          onClick={() => toggleOne(contact.id)}
                          className="flex items-center justify-center text-muted-foreground transition-colors hover:text-primary"
                          aria-label={`Select ${contact.name}`}
                          aria-pressed={isSelected}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="break-words px-3 sm:px-4">
                        <p className="font-medium">{contact.name}</p>
                        <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground sm:hidden">{formatPhone(contact.phone)}</p>
                        {contact.email && <p className="hidden break-all text-xs text-muted-foreground sm:block">{contact.email}</p>}
                      </TableCell>
                      <TableCell className="hidden font-mono text-sm sm:table-cell">{formatPhone(contact.phone)}</TableCell>
                      <TableCell className="px-2 sm:px-4">
                        <span className={`inline-flex max-w-full items-center justify-center whitespace-normal rounded-full px-2 py-1 text-center text-[11px] font-medium sm:px-2.5 sm:py-0.5 sm:text-xs ${STAGE_COLORS[contact.stage ?? "ENQUIRY"]}`}>
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
                      <TableCell className="px-1 text-right sm:px-4">
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
      {selectedIds.size > 0 && typeof document !== "undefined" && createPortal(
        <div className="bulk-contact-actions" aria-label={selectedIds.size + " contacts selected"}>
          <div className="pointer-events-auto mx-auto flex w-full max-w-md animate-slide-up items-center gap-2 rounded-2xl border border-border/60 bg-card/95 px-3 py-3 shadow-float backdrop-blur-xl sm:gap-3 sm:px-4">
            {/* Count */}
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {selectedIds.size}
              </span>
              <span className="hidden text-sm font-medium text-foreground min-[380px]:inline">selected</span>
            </div>

            <div className="h-5 w-px bg-border/60" />

            <Button size="sm" variant="outline" onClick={() => { setPendingBulkStage(""); setBulkStageOpen(true); }} disabled={bulkStageMutation.isPending || selectedIds.size > 200} className="min-w-0 flex-1 gap-1.5">
              <Layers className="h-4 w-4 shrink-0" /><span className="truncate">Change Stage</span>
            </Button>

            <div className="h-5 w-px bg-border/60" />

            {/* Clear */}
            <button
              disabled={bulkStageMutation.isPending}
              onClick={clearSelection}
              className="flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>, document.body
      )}

      <Dialog open={bulkStageOpen} onOpenChange={(open) => { if (!bulkStageMutation.isPending) setBulkStageOpen(open); }}>
        <DialogContent><DialogHeader><DialogTitle>Change stage for selected contacts</DialogTitle></DialogHeader>
          <p className="text-sm">{selectedIds.size} contacts selected across pages. Up to 200 per batch.</p>
          <label htmlFor="bulk-contact-stage" className="text-sm font-medium">New stage</label>
          <select id="bulk-contact-stage" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={pendingBulkStage} disabled={bulkStageMutation.isPending} onChange={(event) => setPendingBulkStage(event.target.value as ContactStage)}>
            <option value="">Pick a stage…</option>{ALL_STAGES.map((stage) => <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>)}
          </select>
          {selectedIds.size > 200 && <p className="text-sm text-destructive">Select at most 200 contacts.</p>}
          {pendingBulkStage && bulkPreview.isFetching && <p className="text-sm">Checking stage template and wallet…</p>}
          {pendingBulkStage && bulkPreview.isError && <p className="text-sm text-destructive">{bulkPreview.error instanceof Error ? bulkPreview.error.message : "Could not load stage preview"}</p>}
          {pendingBulkStage && bulkPreview.data && <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
            <p>{bulkPreview.data.changed} stages will change; {bulkPreview.data.unchanged} already in this stage and will not receive another message.</p>
            {bulkPreview.data.automationEnabled ? <><p className="font-medium">Template: {bulkPreview.data.templateName}</p><p>{bulkPreview.data.messagesToSend} messages will be sent automatically after updating.</p></> : <p>No enabled template is assigned to this stage. Only the stage will update; no message will be sent.</p>}
            {bulkPreview.data.invalidPhones > 0 && <p>{bulkPreview.data.invalidPhones} invalid phone numbers: stage updates only, no message.</p>}
            {bulkPreview.data.cost && <p>Estimated cost: {bulkPreview.data.cost.estimatedCost == null ? "Rate not configured" : formatInr(bulkPreview.data.cost.estimatedCost)} · Balance: {formatInr(bulkPreview.data.cost.availableBalance)}</p>}
            {bulkPreview.data.problem && <p className="text-destructive">{bulkPreview.data.problem}</p>}
          </div>}
          <DialogFooter><Button variant="outline" disabled={bulkStageMutation.isPending} onClick={() => setBulkStageOpen(false)}>Cancel</Button>
            <Button disabled={!pendingBulkStage || !bulkPreview.data?.canApply || bulkPreview.isFetching || bulkPreview.isError || selectedIds.size > 200 || bulkStageMutation.isPending} loading={bulkStageMutation.isPending} onClick={applyBulkStage}>
              {bulkStageMutation.isPending ? "Updating and sending…" : bulkPreview.data?.messagesToSend ? "Update stage & send" : "Update stage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
