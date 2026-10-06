import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Signal } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface MetaConfigResponse {
  appId?: string;
  appSecretMasked?: string;
  wabaId?: string;
  phoneNumberId?: string;
  accessTokenMasked?: string;
  webhookVerifyToken?: string;
  mode: "mock" | "live";
}

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Manage your account, WhatsApp configuration, and system preferences." />

      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp Config</TabsTrigger>
          <TabsTrigger value="system">System Mode</TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <AccountTab />
        </TabsContent>
        <TabsContent value="whatsapp">
          <WhatsAppConfigTab />
        </TabsContent>
        <TabsContent value="system">
          <SystemModeTab />
        </TabsContent>
      </Tabs>
    </div>
  );

  function AccountTab() {
    const [name, setName] = useState(user?.name ?? "");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [error, setError] = useState<string | null>(null);

    const mutation = useMutation({
      mutationFn: () => api.put("/settings/profile", { name, currentPassword: currentPassword || undefined, newPassword: newPassword || undefined }),
      onSuccess: () => {
        toast({ title: "Profile updated", variant: "success" });
        setCurrentPassword("");
        setNewPassword("");
        setError(null);
      },
      onError: (err) => setError(err instanceof ApiRequestError ? err.message : "Update failed"),
    });

    return (
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Update your name, email, and password.</CardDescription>
        </CardHeader>
        <CardContent className="flex max-w-md flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Full Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Current Password</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Required to change password" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>New Password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Leave blank to keep current password" />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button className="w-fit" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Save Changes
          </Button>
        </CardContent>
      </Card>
    );
  }

  function WhatsAppConfigTab() {
    const { data: config } = useQuery({
      queryKey: ["meta-config"],
      queryFn: () => api.get<MetaConfigResponse>("/settings/meta-config"),
    });

    const [appId, setAppId] = useState("");
    const [appSecret, setAppSecret] = useState("");
    const [wabaId, setWabaId] = useState("");
    const [phoneNumberId, setPhoneNumberId] = useState("");
    const [accessToken, setAccessToken] = useState("");
    const [webhookVerifyToken, setWebhookVerifyToken] = useState("");

    useEffect(() => {
      if (config) {
        setAppId(config.appId ?? "");
        setWabaId(config.wabaId ?? "");
        setPhoneNumberId(config.phoneNumberId ?? "");
        setWebhookVerifyToken(config.webhookVerifyToken ?? "");
      }
    }, [config]);

    const testMutation = useMutation({
      mutationFn: () => api.post<{ ok: boolean; message: string }>("/whatsapp-account/test"),
      onSuccess: (res) => toast({ title: res.ok ? "Connection healthy" : "Connection issue", description: res.message, variant: res.ok ? "success" : "destructive" }),
    });

    const saveMutation = useMutation({
      mutationFn: () =>
        api.put("/settings/meta-config", {
          appId,
          appSecret: appSecret || undefined,
          wabaId,
          phoneNumberId,
          accessToken: accessToken || undefined,
          webhookVerifyToken,
        }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["meta-config"] });
        toast({ title: "Configuration saved", variant: "success" });
        setAppSecret("");
        setAccessToken("");
      },
    });

    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Meta / WhatsApp Configuration</CardTitle>
            <CardDescription>Credentials are stored server-side only and masked after saving.</CardDescription>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${config?.mode === "live" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
            {config?.mode === "live" ? "Live Mode" : "Demo / Mock Mode"}
          </span>
        </CardHeader>
        <CardContent className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Meta App ID</Label>
            <Input value={appId} onChange={(e) => setAppId(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Meta App Secret</Label>
            <Input type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder={config?.appSecretMasked || "Not set"} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>WABA ID</Label>
            <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Phone Number ID</Label>
            <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Access Token</Label>
            <Input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder={config?.accessTokenMasked || "Not set"} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Webhook Verify Token</Label>
            <Input value={webhookVerifyToken} onChange={(e) => setWebhookVerifyToken(e.target.value)} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>Save Configuration</Button>
            <Button variant="outline" loading={testMutation.isPending} onClick={() => testMutation.mutate()}>Test Connection</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function SystemModeTab() {
    const { data: config } = useQuery({
      queryKey: ["meta-config"],
      queryFn: () => api.get<MetaConfigResponse>("/settings/meta-config"),
    });

    return (
      <Card>
        <CardHeader>
          <CardTitle>System Mode</CardTitle>
          <CardDescription>Current WhatsApp integration mode, controlled by the META_MODE environment variable.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-lg border border-border p-4">
            <Signal className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">{config?.mode === "live" ? "Live Mode" : "Mock / Demo Mode"}</p>
              <p className="text-xs text-muted-foreground">
                {config?.mode === "live"
                  ? "All messages are sent through the real Meta WhatsApp Business API."
                  : "All WhatsApp activity is simulated. No real messages are sent."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
}
