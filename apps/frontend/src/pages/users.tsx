import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { UserRole } from "@/lib/types";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  pushEnabled: boolean;
  createdAt: string;
}

const ROLE_STYLE: Record<UserRole, { label: string; cls: string }> = {
  ADMIN:       { label: "Admin",       cls: "bg-purple-100 text-purple-700" },
  MANAGER:     { label: "Manager",     cls: "bg-blue-100 text-blue-700" },
  SALESPERSON: { label: "Salesperson", cls: "bg-green-100 text-green-700" },
};

function PhoneCell({ user }: { user: UserRow }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [value, setValue] = useState(user.phone ?? "");
  const dirty = value.trim() !== (user.phone ?? "");
  const save = useMutation({
    mutationFn: () => api.put(`/users/${user.id}/phone`, { phone: value.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast({ title: "WhatsApp number saved", variant: "success" }); },
    onError: (e: any) => toast({ title: e?.message ?? "Could not save number", variant: "destructive" }),
  });
  return (
    <div className="flex items-center gap-2">
      <Input className="h-8 w-44" placeholder="919876543210" value={value} onChange={(e) => setValue(e.target.value)} />
      {dirty && <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>}
    </div>
  );
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<UserRow[]>("/users"),
  });

  const q = search.trim().toLowerCase();
  const users = (data ?? []).filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="All users. The WhatsApp number is where their role's internal notifications are sent (admin, manager or salesperson alerts)." />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : users.length === 0 ? (
          <EmptyState icon={UsersRound} title="No users found" description="Try a different search." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>WhatsApp number</TableHead>
                <TableHead>Push alerts</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_STYLE[u.role].cls}`}>{ROLE_STYLE[u.role].label}</span>
                  </TableCell>
                  <TableCell><PhoneCell user={u} /></TableCell>
                  <TableCell>{u.pushEnabled ? "On" : "Off"}</TableCell>
                  <TableCell>{formatDate(u.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
