import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Key, Plus, Copy, Power, RefreshCw, Trash2, Check } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { ApiKey } from "@/lib/types";

const CURL_EXAMPLE = `curl -X POST https://your-domain.com/api/v1/whatsapp/send \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "919876543210",
    "template": "quotation_ready",
    "language": "en_US",
    "variables": { "1": "Aarav", "2": "Modular Kitchen", "3": "1,45,000" }
  }'`;

const JS_EXAMPLE = `const response = await fetch("https://your-domain.com/api/v1/whatsapp/send", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    phone: "919876543210",
    template: "quotation_ready",
    language: "en_US",
    variables: { "1": "Aarav", "2": "Modular Kitchen", "3": "1,45,000" },
  }),
});

const data = await response.json();
console.log(data);`;

const PHP_EXAMPLE = `<?php
$ch = curl_init("https://your-domain.com/api/v1/whatsapp/send");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer YOUR_API_KEY",
    "Content-Type: application/json",
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    "phone" => "919876543210",
    "template" => "quotation_ready",
    "language" => "en_US",
    "variables" => ["1" => "Aarav", "2" => "Modular Kitchen", "3" => "1,45,000"],
]));

$response = curl_exec($ch);
curl_close($ch);
echo $response;`;

const ENDPOINTS = [
  { method: "POST", path: "/api/v1/whatsapp/send", description: "Send a WhatsApp message using an approved template." },
  { method: "GET", path: "/api/v1/templates", description: "List available templates (approved by default)." },
  { method: "GET", path: "/api/v1/contacts", description: "List contacts, paginated." },
  { method: "POST", path: "/api/v1/contacts", description: "Create a new contact." },
  { method: "POST", path: "/api/v1/campaigns", description: "Create and optionally auto-start a campaign." },
  { method: "GET", path: "/api/v1/notifications", description: "List notification / delivery logs." },
];

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-neutral-900 p-4 text-xs text-neutral-100">
        <code>{code}</code>
      </pre>
      <button
        className="absolute right-2 top-2 rounded-md bg-neutral-800 p-1.5 text-neutral-300 hover:text-white"
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export default function ApiIntegrationPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const { data: keys, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api.get<ApiKey[]>("/api-keys"),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post<{ key: string }>("/api-keys", { name: newKeyName }),
    onSuccess: (res) => {
      setGeneratedKey(res.key);
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api-keys/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  const regenerateMutation = useMutation({
    mutationFn: (id: string) => api.post<{ key: string }>(`/api-keys/${id}/regenerate`),
    onSuccess: (res) => {
      setGeneratedKey(res.key);
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast({ title: "API key revoked", variant: "success" });
      setRevokeTarget(null);
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="API Integration" description="Connect your CRM to KSS WhatsApp Notifications." />

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
        </TabsList>

        <TabsContent value="keys">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Generate keys for your CRM or other systems to authenticate with the public API.</CardDescription>
              </div>
              <Button onClick={() => { setNewKeyName(""); setGeneratedKey(null); setCreateOpen(true); }}>
                <Plus className="h-4 w-4" /> Generate Key
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? null : !keys || keys.length === 0 ? (
                <EmptyState icon={Key} title="No API keys yet" description="Generate a key to allow your CRM to send notifications." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keys.map((k) => (
                      <TableRow key={k.id}>
                        <TableCell className="font-medium">{k.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{k.keyPrefix}&hellip;</TableCell>
                        <TableCell><StatusBadge status={k.revokedAt ? "REJECTED" : k.enabled ? "APPROVED" : "DISABLED"} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(k.lastUsedAt)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(k.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" title="Toggle" onClick={() => toggleMutation.mutate(k.id)} disabled={!!k.revokedAt}>
                              <Power className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Regenerate" onClick={() => regenerateMutation.mutate(k.id)} disabled={!!k.revokedAt}>
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Revoke" onClick={() => setRevokeTarget(k)} disabled={!!k.revokedAt}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Endpoints</CardTitle>
                <CardDescription>All requests to /api/v1/* require an Authorization: Bearer &lt;api_key&gt; header.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Method</TableHead><TableHead>Path</TableHead><TableHead>Description</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {ENDPOINTS.map((e) => (
                      <TableRow key={e.path + e.method}>
                        <TableCell className="font-mono text-xs font-semibold text-primary">{e.method}</TableCell>
                        <TableCell className="font-mono text-xs">{e.path}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{e.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Send a Message</CardTitle>
                <CardDescription>POST /api/v1/whatsapp/send &mdash; only approved templates can be used.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">cURL</p>
                  <CodeBlock code={CURL_EXAMPLE} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">JavaScript (fetch)</p>
                  <CodeBlock code={JS_EXAMPLE} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">PHP</p>
                  <CodeBlock code={PHP_EXAMPLE} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Response</p>
                  <CodeBlock code={`{
  "success": true,
  "messageId": "wamid.mock.xxxxxxxx",
  "status": "SENT"
}`} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{generatedKey ? "API Key Generated" : "Generate API Key"}</DialogTitle>
            <DialogDescription>
              {generatedKey ? "Copy this key now. For security, it will not be shown again." : "Give this key a descriptive name, e.g. 'CRM Integration'."}
            </DialogDescription>
          </DialogHeader>

          {generatedKey ? (
            <div className="flex flex-col gap-3">
              <CodeBlock code={generatedKey} />
              <p className="text-xs text-warning">Store this key securely. You will only see it once.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label>Key Name</Label>
              <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="CRM Integration" />
            </div>
          )}

          <DialogFooter>
            {generatedKey ? (
              <DialogClose asChild><Button>Done</Button></DialogClose>
            ) : (
              <>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button disabled={!newKeyName.trim()} loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
                  Generate
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke API key"
        description={`Revoking "${revokeTarget?.name}" will immediately disable it. Any integrations using this key will stop working.`}
        confirmLabel="Revoke"
        loading={revokeMutation.isPending}
        onConfirm={() => revokeTarget && revokeMutation.mutate(revokeTarget.id)}
      />
    </div>
  );
}
