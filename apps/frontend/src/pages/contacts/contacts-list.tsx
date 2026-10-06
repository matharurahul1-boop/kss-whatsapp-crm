import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Search, Upload, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import { formatPhone } from "@/lib/utils";
import { Contact, PaginatedResult } from "@/lib/types";
import { ContactFormDialog } from "./contact-form-dialog";
import { CsvImportDialog } from "./csv-import-dialog";

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

  const params = new URLSearchParams({ page: String(page), pageSize: "10" });
  if (search) params.set("search", search);
  if (source) params.set("source", source);

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", search, source, page],
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
            <Button
              onClick={() => {
                setEditContact(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New Contact
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, phone, email..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={source || "ALL"} onValueChange={(v) => { setSource(v === "ALL" ? "" : v); setPage(1); }}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Sources</SelectItem>
            {["MANUAL", "CRM_API", "EXHIBITION", "WEBSITE", "IMPORT"].map((s) => (
              <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <p className="font-medium">{contact.name}</p>
                      {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{formatPhone(contact.phone)}</TableCell>
                    <TableCell><Badge variant="outline">{contact.source.replace("_", " ")}</Badge></TableCell>
                    <TableCell>
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
                          <DropdownMenuItem
                            onClick={() => {
                              setEditContact(contact);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(contact)}>
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
