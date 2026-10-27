import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { MessageCircle, FileText, Send, CheckCheck, Plus, TrendingUp, IndianRupee, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/utils";
import { Campaign, Notification, WhatsAppAccount, STAGE_LABELS, ContactStage } from "@/lib/types";

interface DashboardSummary {
  account: WhatsAppAccount | null;
  templatesByStatus: { status: string; count: number }[];
  notificationsByStatus: { status: string; count: number }[];
  campaignsByStatus: { status: string; count: number }[];
  recentCampaigns: Campaign[];
  recentNotifications: Notification[];
}

interface DeliveryPoint {
  date: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

interface StageFunnelData {
  stages: { stage: string; count: number }[];
  totalContacts: number;
  totalPipelineValue: number;
}

function countFor(items: { status: string; count: number }[], status: string): number {
  return items.find((i) => i.status === status)?.count ?? 0;
}

function formatCurrency(v: number): string {
  if (v >= 10_00_000) return `₹${(v / 10_00_000).toFixed(1)}L`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(0)}K`;
  return `₹${v}`;
}

const FUNNEL_COLORS: Record<string, string> = {
  ENQUIRY: "#3b82f6",
  PROSPECT: "#8b5cf6",
  VISIT_SCHEDULED: "#f59e0b",
  VISITED: "#f97316",
  NEGOTIATION: "#ef4444",
  PI_CREATED: "#06b6d4",
  SALES_ORDER: "#0ea5e9",
  PRODUCTION: "#6366f1",
  READY_DISPATCH: "#a855f7",
  DISPATCHED: "#d946ef",
  INSTALLATION: "#84cc16",
  HANDOVER: "#22c55e",
  SERVICE_REQUEST: "#14b8a6",
  TICKET_OPEN: "#f43f5e",
  TICKET_CLOSED: "#10b981",
  ON_HOLD: "#78716c",
  LOST: "#9ca3af",
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.get<DashboardSummary>("/dashboard/summary"),
  });

  const { data: deliveryOverview } = useQuery({
    queryKey: ["delivery-overview"],
    queryFn: () => api.get<DeliveryPoint[]>("/dashboard/delivery-overview"),
  });

  const { data: funnelData } = useQuery({
    queryKey: ["stage-funnel"],
    queryFn: () => api.get<StageFunnelData>("/dashboard/stage-funnel"),
  });

  const templates = summary?.templatesByStatus ?? [];
  const notifications = summary?.notificationsByStatus ?? [];
  const campaigns = summary?.campaignsByStatus ?? [];

  const cards = [
    {
      label: "WhatsApp Account",
      value: summary?.account?.status === "CONNECTED" ? "Connected" : "Not Connected",
      sub: summary?.account?.businessName ?? "Not configured",
      icon: MessageCircle,
    },
    {
      label: "Approved Templates",
      value: countFor(templates, "APPROVED"),
      sub: `${countFor(templates, "PENDING")} pending review`,
      icon: FileText,
    },
    {
      label: "Messages Sent",
      value: countFor(notifications, "SENT") + countFor(notifications, "DELIVERED") + countFor(notifications, "READ"),
      sub: `${countFor(notifications, "DELIVERED") + countFor(notifications, "READ")} delivered`,
      icon: Send,
    },
    {
      label: "Read Rate Messages",
      value: countFor(notifications, "READ"),
      sub: `${countFor(notifications, "FAILED")} failed`,
      icon: CheckCheck,
    },
  ];

  const stages = funnelData?.stages ?? [];
  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  const activeStages = stages.filter((s) => s.count > 0);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero card ── */}
      <div
        className="relative overflow-hidden rounded-[20px] p-5 text-white"
        style={{
          background: "linear-gradient(120deg, hsl(28 82% 22%), hsl(38 80% 42%))",
          boxShadow: "0 8px 28px -6px hsl(28 82% 11% / 0.45)",
        }}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/8" />
        <div className="pointer-events-none absolute bottom-[-20px] right-12 h-24 w-24 rounded-full bg-white/5" />
        <p className="text-[11px] font-bold uppercase tracking-widest opacity-75">{getGreeting()}</p>
        <p className="mt-1 text-2xl font-extrabold tracking-tight">{user?.name ?? "KSS Team"} 👋</p>
        <p className="mt-1 text-sm font-medium opacity-70">KSS Interiors · WhatsApp CRM</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/contacts">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/18 px-3 py-1 text-xs font-bold backdrop-blur-sm transition-colors hover:bg-white/25">
              <Users className="h-3 w-3" /> Contacts
            </span>
          </Link>
          <Link to="/campaigns/new">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/18 px-3 py-1 text-xs font-bold backdrop-blur-sm transition-colors hover:bg-white/25">
              <Plus className="h-3 w-3" /> Campaign
            </span>
          </Link>
          <Link to="/send">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/18 px-3 py-1 text-xs font-bold backdrop-blur-sm transition-colors hover:bg-white/25">
              <Send className="h-3 w-3" /> Send Message
            </span>
          </Link>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
          : cards.map((card, i) => {
              const variants = ["metric-tile-brown", "metric-tile-blue", "metric-tile-green", "metric-tile-rose"];
              return (
                <div key={card.label} className={`metric-tile ${variants[i]}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-widest opacity-70">{card.label}</p>
                      <p className="mt-2 text-3xl font-bold tracking-tight">{card.value}</p>
                      <p className="mt-1 text-xs opacity-65">{card.sub}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm shadow-inner">
                      <card.icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              );
            })}
      </div>

      {/* ── Pipeline KPI cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Total Contacts",
            value: funnelData?.totalContacts ?? "—",
            sub: "Across all stages",
            icon: Users,
            variant: "metric-tile-purple",
          },
          {
            label: "Pipeline Value",
            value: funnelData ? formatCurrency(funnelData.totalPipelineValue) : "—",
            sub: "Sum of all budgets",
            icon: IndianRupee,
            variant: "metric-tile-amber",
          },
          {
            label: "Conversion Rate",
            value: funnelData && funnelData.totalContacts > 0
              ? `${((stages.find((s) => s.stage === "HANDOVER")?.count ?? 0) / funnelData.totalContacts * 100).toFixed(1)}%`
              : "—",
            sub: "Enquiry → Handover",
            icon: TrendingUp,
            variant: "metric-tile-green",
          },
        ].map((kpi) => (
          <div key={kpi.label} className={`metric-tile ${kpi.variant}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest opacity-70">{kpi.label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight">{kpi.value}</p>
                <p className="mt-1 text-xs opacity-65">{kpi.sub}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm shadow-inner">
                <kpi.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Conversion Funnel ── */}
      <div className="glass-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Conversion Funnel — Stage-wise Contact Count</h3>
        {!funnelData ? (
          <Skeleton className="h-64 w-full" />
        ) : activeStages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No contacts yet. Add contacts to see the funnel.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {stages.map(({ stage, count }) => {
              const pct = Math.round((count / maxCount) * 100);
              const color = FUNNEL_COLORS[stage] ?? "#9ca3af";
              const label = STAGE_LABELS[stage as ContactStage] ?? stage;
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 text-right text-xs font-medium text-muted-foreground">{label}</span>
                  <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-secondary/70">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: count > 0
                          ? `linear-gradient(90deg, ${color}cc, ${color})`
                          : color,
                        opacity: count === 0 ? 0.15 : 1,
                        boxShadow: count > 0 ? `0 0 8px ${color}55` : undefined,
                      }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-left text-sm font-bold" style={{ color: count > 0 ? color : undefined }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Delivery Overview + Campaigns by Status ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 card-enhanced">
          <CardHeader>
            <CardTitle>Delivery Overview (last 14 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-72 pl-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={deliveryOverview ?? []} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="sent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(158 64% 30%)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(158 64% 30%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(220 13% 90%)" }} />
                <Area type="monotone" dataKey="delivered" stroke="hsl(158 64% 30%)" fill="url(#sent)" strokeWidth={2} name="Delivered" />
                <Area type="monotone" dataKey="read" stroke="hsl(38 92% 45%)" fillOpacity={0} strokeWidth={2} name="Read" />
                <Area type="monotone" dataKey="failed" stroke="hsl(0 72% 51%)" fillOpacity={0} strokeWidth={2} name="Failed" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campaigns by Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {campaigns.length === 0 && <p className="text-sm text-muted-foreground">No campaigns yet.</p>}
            {campaigns.map((c) => (
              <div key={c.status} className="flex items-center justify-between text-sm">
                <StatusBadge status={c.status} />
                <span className="font-medium">{c.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Campaigns + Notifications ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent Campaigns</CardTitle>
            <Link to="/campaigns" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(summary?.recentCampaigns ?? []).length === 0 && <p className="text-sm text-muted-foreground">No campaigns yet.</p>}
            {summary?.recentCampaigns.map((c) => (
              <Link key={c.id} to={`/campaigns/${c.id}`} className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-secondary/40">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.template?.name} &middot; {c.totalRecipients} recipients</p>
                </div>
                <StatusBadge status={c.status} />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent Notifications</CardTitle>
            <Link to="/notifications" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(summary?.recentNotifications ?? []).length === 0 && <p className="text-sm text-muted-foreground">No notifications yet.</p>}
            {summary?.recentNotifications.map((n) => (
              <div key={n.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">{n.contact?.name ?? formatPhone(n.phone)}</p>
                  <p className="text-xs text-muted-foreground">{n.template?.name ?? "-"} &middot; {formatDate(n.createdAt)}</p>
                </div>
                <StatusBadge status={n.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
