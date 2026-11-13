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
import { useAuth } from "@/lib/auth-context";
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

function EditableCells({ user, canEdit }: { user: UserRow; canEdit: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<UserRole>(user.role);
  const [phone, setPhone] = useState(user.phone ?? "");
  const dirty = name.trim() !== user.name || role !== user.role || phone.trim() !== (user.phone ?? "");
  const save = useMutation({
    mutationFn: () => api.put(`/users/${user.id}`, { name: name.trim(), role, phone: phone.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast({ title: "User updated", variant: "success" }); },
    onError: (e: any) => { setRole(user.role); toast({ title: e?.message ?? "Could not update user", variant: "destructive" }); },
  });

  if (!canEdit) {
    return (
      <>
        <TableCell className="font-medium">{user.name}</TableCell>
        <TableCell>{user.email}</TableCell>
        <TableCell><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_STYLE[user.role].cls}`}>{ROLE_STYLE[user.role].label}</span></TableCell>
        <TableCell>{user.phone ?? "—"}</TableCell>
      </>
    );
  }
  return (
    <>
      <TableCell><Input className="h-8 w-40" value={name} onChange={(e) => setName(e.target.value)} /></TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell>
        <select className="rounded-lg border border-border bg-background px-2 py-1 text-sm" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          {(Object.keys(ROLE_STYLE) as UserRole[]).map((r) => <option key={r} value={r}>{ROLE_STYLE[r].label}</option>)}
        </select>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Input className="h-8 w-40" placeholder="919876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {dirty && <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>Save</Button>}
        </div>
      </TableCell>
    </>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const isAdmin = me?.role === "ADMIN";
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<UserRow[]>("/users"),
  });

  const q = search.trim().toLowerCase();
  const users = (data ?? []).filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description={isAdmin ? "Edit names, roles and WhatsApp numbers. The number receives that role's internal notifications." : "All users. Only admins can edit them."} />

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
                  <EditableCells user={u} canEdit={isAdmin} />
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
