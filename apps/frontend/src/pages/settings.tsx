import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Signal, Zap, Bell, User, Building2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ContactStage, STAGE_LABELS, WhatsAppTemplate } from "@/lib/types";

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

      <Tabs defaultValue="triggers">
        <TabsList className="flex-wrap">
          <TabsTrigger value="triggers">Triggers</TabsTrigger>
          <TabsTrigger value="automation">Stage Automation</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp Config</TabsTrigger>
          <TabsTrigger value="system">System Mode</TabsTrigger>
        </TabsList>

        <TabsContent value="triggers">
          <TriggersTab />
        </TabsContent>
        <TabsContent value="account">
          <AccountTab />
        </TabsContent>
        <TabsContent value="whatsapp">
          <WhatsAppConfigTab />
        </TabsContent>
        <TabsContent value="automation">
          <AutomationTab />
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

  /* ── Triggers Tab ────────────────────────────────────────────────── */
  function TriggersTab() {
    interface TriggerRow {
      event: string;
      label: string;
      recipient: "CUSTOMER" | "ADMIN" | "SALESPERSON";
      templateName: string;
      language: string;
      enabled: boolean;
    }

    const { data: triggers, refetch, isLoading } = useQuery({
      queryKey: ["triggers"],
      queryFn: () => api.get<TriggerRow[]>("/triggers"),
    });

    const { data: templates } = useQuery({
      queryKey: ["templates-approved"],
      queryFn: () => api.get<{ items: WhatsAppTemplate[] }>("/templates?status=APPROVED&pageSize=100"),
    });

    const approvedTemplates = templates?.items ?? [];

    const saveMutation = useMutation({
      mutationFn: ({ event, templateName, language, enabled }: Omit<TriggerRow, "label" | "recipient">) =>
        api.put(`/triggers/${event}`, { templateName, language, enabled }),
      onSuccess: () => { refetch(); toast({ title: "Trigger saved", variant: "success" }); },
      onError:   () => toast({ title: "Failed to save", variant: "error" }),
    });

    const GROUPS = [
      { key: "CUSTOMER",   label: "Customer Notifications",  icon: User,      color: "text-blue-600"  },
      { key: "ADMIN",      label: "Admin Alerts",            icon: Building2, color: "text-amber-600" },
      { key: "SALESPERSON",label: "Salesperson Reminders",   icon: Bell,      color: "text-violet-600"},
    ] as const;

    function TriggerRow({ row }: { row: TriggerRow }) {
      const [tplName, setTplName] = useState(row.templateName ?? "");
      const [lang, setLang]       = useState(row.language ?? "en");
      const [enabled, setEnabled] = useState(row.enabled ?? false);

      useEffect(() => {
        setTplName(row.templateName ?? "");
        setLang(row.language ?? "en");
        setEnabled(row.enabled ?? false);
      }, [row.templateName, row.language, row.enabled]);

      const isDirty = tplName !== (row.templateName ?? "") || lang !== (row.language ?? "en") || enabled !== (row.enabled ?? false);

      return (
        <div className={cn(
          "flex flex-col gap-3 rounded-xl border p-4 transition-all",
          enabled ? "border-primary/20 bg-primary/5" : "border-border bg-card"
        )}>
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-1 items-center gap-2.5">
              <span className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                enabled ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              )}>
                {enabled ? "ON" : "OFF"}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{row.label}</p>
                {tplName && (
                  <p className="text-xs text-muted-foreground">
                    Template: <span className="font-mono text-primary">{tplName}</span>
                  </p>
                )}
              </div>
            </div>
            <label className="flex cursor-pointer items-center">
              <div className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                enabled ? "bg-primary" : "bg-border"
              )}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="sr-only"
                />
                <div className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                  enabled ? "translate-x-4" : "translate-x-0.5"
                )} />
              </div>
            </label>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={tplName || "__none__"} onValueChange={(v) => setTplName(v === "__none__" ? "" : v)}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue placeholder="Select approved template…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— No template —</SelectItem>
                {approvedTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                ))}
                {approvedTemplates.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No approved templates yet</div>
                )}
              </SelectContent>
            </Select>

            <Input
              className="w-20 h-8 shrink-0 text-xs"
              placeholder="Lang"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
            />

            <Button
              size="sm"
              variant={isDirty ? "default" : "outline"}
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate({ event: row.event, templateName: tplName, language: lang, enabled })}
              className="shrink-0 h-8"
            >
              Save
            </Button>
          </div>
        </div>
      );
    }

    if (isLoading) {
      return <div className="p-8 text-center text-sm text-muted-foreground">Loading triggers…</div>;
    }

    return (
      <div className="flex flex-col gap-6">
        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-xs text-amber-800 dark:text-amber-200">
            <p className="font-semibold">15 Notification Triggers</p>
            <p className="mt-0.5">These triggers fire WhatsApp templates automatically when business events occur.
            Select an <strong>Approved</strong> template for each trigger you want to activate.
            Templates must first be created and approved in Meta Business Manager.</p>
          </div>
        </div>

        {GROUPS.map(({ key, label, icon: Icon, color }) => {
          const rows = (triggers ?? []).filter((r) => r.recipient === key);
          const activeCount = rows.filter((r) => r.enabled && r.templateName).length;
          return (
            <div key={key} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Icon className={cn("h-4 w-4", color)} />
                <h3 className="text-sm font-bold text-foreground">{label}</h3>
                <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {activeCount}/{rows.length} active
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {rows.map((r) => <TriggerRow key={r.event} row={r} />)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function AutomationTab() {
    const { toast } = useToast();

    const STAGE_GROUPS = [
      { label: "Pre-sale Pipeline",       stages: ["ENQUIRY","PROSPECT","VISIT_SCHEDULED","VISITED","NEGOTIATION"] as ContactStage[] },
      { label: "Sales Milestones",        stages: ["PI_CREATED","SALES_ORDER"] as ContactStage[] },
      { label: "Order Production & Delivery", stages: ["PRODUCTION","READY_DISPATCH","DISPATCHED","INSTALLATION","HANDOVER"] as ContactStage[] },
      { label: "Post-sale Service",       stages: ["SERVICE_REQUEST","TICKET_OPEN","TICKET_CLOSED"] as ContactStage[] },
      { label: "Terminal Stages",         stages: ["ON_HOLD","LOST"] as ContactStage[] },
    ];
    const stages = Object.keys(STAGE_LABELS) as ContactStage[];

    const { data: templates } = useQuery({
      queryKey: ["templates-approved"],
      queryFn: () => api.get<{ items: WhatsAppTemplate[] }>("/templates?status=APPROVED&pageSize=100"),
    });

    const { data: stageTpls, refetch } = useQuery({
      queryKey: ["stage-templates"],
      queryFn: () => api.get<{ stage: string; templateName: string; language: string; enabled: boolean }[]>("/contacts/stage-templates"),
    });

    const approvedTemplates = templates?.items ?? [];

    const saveMutation = useMutation({
      mutationFn: ({ stage, templateName, language, enabled }: { stage: string; templateName: string; language: string; enabled: boolean }) =>
        api.put(`/contacts/stage-templates/${stage}`, { templateName, language, enabled }),
      onSuccess: () => { refetch(); toast({ title: "Saved", variant: "success" }); },
      onError: () => toast({ title: "Failed to save", variant: "error" }),
    });

    function StageRow({ stage }: { stage: ContactStage }) {
      const current = stageTpls?.find((s) => s.stage === stage);
      const [tplName, setTplName] = useState(current?.templateName ?? "");
      const [lang, setLang] = useState(current?.language ?? "en");
      const [enabled, setEnabled] = useState(current?.enabled ?? true);

      useEffect(() => {
        setTplName(current?.templateName ?? "");
        setLang(current?.language ?? "en");
        setEnabled(current?.enabled ?? true);
      }, [current?.templateName, current?.language, current?.enabled]);

      return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 border-b last:border-0">
          <div className="w-40 shrink-0">
            <p className="text-sm font-medium">{STAGE_LABELS[stage]}</p>
            <p className="text-xs text-muted-foreground">{stage === "LEAD" ? "Sent on contact create" : "Sent on stage change"}</p>
          </div>

          <div className="flex-1 flex flex-col sm:flex-row gap-2">
            <Select value={tplName || "__none__"} onValueChange={(v) => setTplName(v === "__none__" ? "" : v)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select template..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— No template —</SelectItem>
                {approvedTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              className="w-24 shrink-0"
              placeholder="Language"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
            />

            <label className="flex items-center gap-1.5 text-sm shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded"
              />
              Active
            </label>

            <Button
              size="sm"
              disabled={!tplName || saveMutation.isPending}
              onClick={() => saveMutation.mutate({ stage, templateName: tplName, language: lang, enabled })}
            >
              Save
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="text-xs text-foreground/70">
            <p className="font-semibold text-foreground">Stage Automation</p>
            <p className="mt-0.5">Configure which WhatsApp template auto-sends when a contact reaches each stage.
            Only <strong>APPROVED</strong> templates appear in the dropdown.
            The first stage (Enquiry) fires when a new contact is created.</p>
          </div>
        </div>

        {STAGE_GROUPS.map((group) => (
          <Card key={group.label} className="overflow-hidden">
            <CardHeader className="border-b border-border/60 py-3 px-5">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {group.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0 px-5">
              {group.stages.map((stage) => (
                <StageRow key={stage} stage={stage} />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
}
