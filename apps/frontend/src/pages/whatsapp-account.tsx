import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Link2, RefreshCw, ShieldCheck, Signal } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { WhatsAppAccount } from "@/lib/types";

export default function WhatsAppAccountPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: account, isLoading } = useQuery({
    queryKey: ["whatsapp-account"],
    queryFn: () => api.get<WhatsAppAccount>("/whatsapp-account"),
  });

  const connectMutation = useMutation({
    mutationFn: () => api.post<WhatsAppAccount>("/whatsapp-account/connect"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-account"] });
      toast({ title: "Account connected", description: "WhatsApp Business account connected successfully.", variant: "success" });
    },
    onError: () => toast({ title: "Connection failed", variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: () => api.post<{ ok: boolean; message: string }>("/whatsapp-account/test"),
    onSuccess: (data) => {
      toast({ title: data.ok ? "Connection healthy" : "Connection issue", description: data.message, variant: data.ok ? "success" : "destructive" });
    },
  });

  const connected = account?.status === "CONNECTED";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="WhatsApp Account" description="Manage your connection to WhatsApp Business for KSS Interiors." />

      {account?.mode === "mock" && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Demo / Mock Mode is active. No real messages are sent to WhatsApp; all activity is simulated for demonstration purposes.
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Connection Status</CardTitle>
                <CardDescription>Current state of your WhatsApp Business API connection.</CardDescription>
              </div>
              <Badge variant={connected ? "success" : "secondary"}>
                <Circle className={`mr-1 h-2 w-2 fill-current ${connected ? "text-success" : "text-muted-foreground"}`} />
                {connected ? "Connected" : "Not Connected"}
              </Badge>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Business Name" value={account?.businessName ?? "-"} />
              <Field label="WABA ID" value={account?.wabaId ?? "-"} mono />
              <Field label="Phone Number ID" value={account?.phoneNumberId ?? "-"} mono />
              <Field label="Display Phone Number" value={account?.displayPhoneNumber ?? "-"} />
              <Field label="Quality Rating" value={account?.qualityRating ?? "-"} />
              <Field label="Last Connected" value={formatDate(account?.lastConnectedAt)} />
            </CardContent>
            <CardContent className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button onClick={() => connectMutation.mutate()} loading={connectMutation.isPending}>
                <Link2 className="h-4 w-4" /> {connected ? "Reconnect" : "Connect"}
              </Button>
              <Button variant="outline" onClick={() => testMutation.mutate()} loading={testMutation.isPending} disabled={!connected}>
                <ShieldCheck className="h-4 w-4" /> Test Connection
              </Button>
              <Button variant="ghost" onClick={() => queryClient.invalidateQueries({ queryKey: ["whatsapp-account"] })}>
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Integration Mode</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <Signal className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">{account?.mode === "live" ? "Live Mode" : "Mock / Demo Mode"}</p>
                  <p className="text-xs text-muted-foreground">
                    {account?.mode === "live"
                      ? "Connected to the real Meta WhatsApp Business API."
                      : "Simulated WhatsApp responses for safe demonstration."}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                Switch modes with the META_MODE environment variable on the backend.
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
