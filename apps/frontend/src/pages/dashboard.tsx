import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  MessageCircle, FileText, Send, CheckCheck, Plus, TrendingUp,
  IndianRupee, Users, Megaphone, Settings, Zap,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
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
interface DeliveryPoint { date: string; sent: number; delivered: number; read: number; failed: number; }
interface StageFunnelData { stages: { stage: string; count: number }[]; totalContacts: number; totalPipelineValue: number; }

function countFor(items: { status: string; count: number }[], status: string) {
  return items.find((i) => i.status === status)?.count ?? 0;
}
function formatCurrency(v: number) {
  if (v >= 10_00_000) return `₹${(v / 10_00_000).toFixed(1)}L`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(0)}K`;
  return `₹${v}`;
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

const FUNNEL_COLORS: Record<string, string> = {
  ENQUIRY: "#7B4F2E", PROSPECT: "#8b5cf6", VISIT_SCHEDULED: "#f59e0b",
  VISITED: "#f97316", NEGOTIATION: "#ef4444", PI_CREATED: "#06b6d4",
  SALES_ORDER: "#0ea5e9", PRODUCTION: "#6366f1", READY_DISPATCH: "#a855f7",
  DISPATCHED: "#d946ef", INSTALLATION: "#84cc16", HANDOVER: "#22c55e",
  SERVICE_REQUEST: "#14b8a6", TICKET_OPEN: "#f43f5e", TICKET_CLOSED: "#10b981",
  ON_HOLD: "#78716c", LOST: "#9ca3af",
};

// Glass stat card matching Artifact
function StatCard({
  label, value, sub, icon: Icon, accentColor, iconBg, iconColor, progress, loading,
}: {
  label: string; value: string | number; sub: string;
  icon: React.ElementType; accentColor: string; iconBg: string; iconColor: string;
  progress?: number; loading?: boolean;
}) {
  if (loading) return <Skeleton className="h-36 rounded-[20px]" />;
  return (
    <div
      className="glass-card relative overflow-hidden p-4"
      style={{ borderRadius: 20 }}
    >
      {/* Colored top accent bar */}
      <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-[20px]" style={{ background: accentColor }} />

      {/* Icon */}
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[13px]" style={{ background: iconBg }}>
        <Icon className="h-[18px] w-[18px]" style={{ color: iconColor }} strokeWidth={2} />
      </div>

      <p className="text-[10px] font-bold uppercase tracking-[.09em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-3xl font-bold leading-none" style={{ color: iconColor }}>{value}</p>
      <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">{sub}</p>

      {/* Progress bar */}
      {progress !== undefined && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-border/60" style={{ background: "repeating-linear-gradient(135deg,hsl(34 20% 88%) 0 4px,hsl(34 15% 82%) 4px 8px)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(progress, 100)}%`,
              background: accentColor,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,.45), inset 0 -1px 0 rgba(0,0,0,.12)`,
            }}
          />
        </div>
      )}
    </div>
  );
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
  const stages = funnelData?.stages ?? [];
  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  const totalMsgs = countFor(notifications, "SENT") + countFor(notifications, "DELIVERED") + countFor(notifications, "READ");
  const approvedTpl = countFor(templates, "APPROVED");

  return (
    <div className="flex flex-col gap-5">

      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden rounded-[20px] p-5 text-white"
        style={{
          background: "linear-gradient(120deg, hsl(28 82% 20%), hsl(38 78% 40%))",
          boxShadow: "0 8px 28px -6px hsl(28 82% 11% / 0.50)",
        }}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/[.07]" />
        <div className="pointer-events-none absolute -bottom-6 right-14 h-28 w-28 rounded-full bg-white/[.04]" />
        <p className="text-[11px] font-bold uppercase tracking-widest opacity-75">{getGreeting()}</p>
        <p className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-tight">{user?.name ?? "KSS Team"} 👋</p>
        <p className="mt-1 text-[13px] font-medium opacity-65">KSS Interiors · WhatsApp CRM</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { to: "/contacts",     icon: Users,     label: "Contacts" },
            { to: "/campaigns/new",icon: Plus,       label: "Campaign" },
            { to: "/send",         icon: Send,       label: "Send Message" },
          ].map(({ to, icon: Ic, label }) => (
            <Link key={to} to={to}>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/[.15] px-3 py-1 text-[11px] font-bold backdrop-blur-sm transition-colors hover:bg-white/25">
                <Ic className="h-3 w-3" /> {label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── 4 glass stat cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Contacts" value={funnelData?.totalContacts ?? "—"}
          sub={`Pipeline: ${funnelData ? formatCurrency(funnelData.totalPipelineValue) : "—"}`}
          icon={Users}
          accentColor="linear-gradient(90deg,#7B4F2E,#C9973A)"
          iconBg="hsl(38 80% 90%)" iconColor="#7B4F2E"
          progress={74} loading={isLoading}
        />
        <StatCard
          label="Messages Sent" value={totalMsgs || "—"}
          sub={`${countFor(notifications, "DELIVERED") + countFor(notifications, "READ")} delivered`}
          icon={MessageCircle}
          accentColor="linear-gradient(90deg,#2A7B6E,#45A898)"
          iconBg="hsl(172 40% 90%)" iconColor="#2A7B6E"
          progress={totalMsgs > 0 ? Math.round(((countFor(notifications,"DELIVERED")+countFor(notifications,"READ"))/totalMsgs)*100) : 0}
          loading={isLoading}
        />
        <StatCard
          label="Templates" value={approvedTpl || "—"}
          sub={`${countFor(templates,"PENDING")} pending`}
          icon={FileText}
          accentColor="linear-gradient(90deg,#C4623A,#E0855A)"
          iconBg="hsl(20 80% 92%)" iconColor="#C4623A"
          progress={approvedTpl > 0 ? 100 : 0} loading={isLoading}
        />
        <StatCard
          label="Read Rate" value={countFor(notifications,"READ") || "—"}
          sub={`${countFor(notifications,"FAILED")} failed`}
          icon={CheckCheck}
          accentColor="linear-gradient(90deg,#5B4DA8,#7B6EC8)"
          iconBg="hsl(247 45% 92%)" iconColor="#5B4DA8"
          progress={totalMsgs > 0 ? Math.round((countFor(notifications,"READ")/totalMsgs)*100) : 0}
          loading={isLoading}
        />
      </div>

      {/* ── Quick Actions ── */}
      <div className="glass-card p-4" style={{ borderRadius: 20 }}>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[.09em] text-muted-foreground">Quick Actions</p>
        <div className="grid grid-cols-4 gap-3">
          {[
            { to: "/contacts",     icon: Users,      label: "New Lead",   bg: "hsl(38 80% 90%)",  color: "#7B4F2E" },
            { to: "/conversations",icon: MessageCircle,label:"Chats",     bg: "hsl(172 40% 90%)", color: "#2A7B6E" },
            { to: "/templates",    icon: FileText,   label: "Templates",  bg: "hsl(20 80% 92%)",  color: "#C4623A" },
            { to: "/settings",     icon: Settings,   label: "Settings",   bg: "hsl(247 45% 92%)", color: "#5B4DA8" },
          ].map(({ to, icon: Ic, label, bg, color }) => (
            <Link key={to} to={to} className="flex flex-col items-center gap-1.5">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-border/50 transition-transform active:scale-90 hover:scale-105"
                style={{ background: bg, boxShadow: "0 2px 10px -3px rgba(80,40,10,.12)" }}
              >
                <Ic className="h-6 w-6" style={{ color }} strokeWidth={1.8} />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Conversion Funnel ── */}
      <div className="glass-card p-4" style={{ borderRadius: 20 }}>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[.09em] text-muted-foreground">Conversion Funnel</p>
        {!funnelData ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : stages.filter(s => s.count > 0).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No contacts yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {stages.map(({ stage, count }) => {
              const pct = Math.round((count / maxCount) * 100);
              const color = FUNNEL_COLORS[stage] ?? "#9ca3af";
              return (
                <div key={stage} className="flex items-center gap-2.5">
                  <span className="w-28 shrink-0 text-right text-[11px] font-semibold text-muted-foreground">{STAGE_LABELS[stage as ContactStage] ?? stage}</span>
                  <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-border/40">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: count > 0 ? `linear-gradient(90deg,${color}cc,${color})` : color,
                        opacity: count === 0 ? 0.12 : 1,
                        boxShadow: count > 0 ? `0 0 6px ${color}44` : undefined,
                      }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-left text-xs font-bold" style={{ color: count > 0 ? color : undefined }}>{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Delivery Chart ── */}
      <div className="glass-card p-4" style={{ borderRadius: 20 }}>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[.09em] text-muted-foreground">Delivery Overview · Last 14 Days</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={deliveryOverview ?? []} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-del" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2A7B6E" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2A7B6E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(34 15% 85%)" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 10, fontFamily: "Manrope" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fontFamily: "Manrope" }} axisLine={false} tickLine={false} width={24} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 11, border: "1px solid hsl(38 60% 70% / .4)", background: "hsl(34 40% 97%)", fontFamily: "Manrope" }} />
              <Area type="monotone" dataKey="delivered" stroke="#2A7B6E" fill="url(#grad-del)" strokeWidth={2} name="Delivered" />
              <Area type="monotone" dataKey="read" stroke="#C9973A" fillOpacity={0} strokeWidth={2} name="Read" />
              <Area type="monotone" dataKey="failed" stroke="#C4623A" fillOpacity={0} strokeWidth={2} name="Failed" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <div className="glass-card p-4" style={{ borderRadius: 20 }}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[.09em] text-muted-foreground">Recent Activity</p>
          <Link to="/notifications" className="text-[11px] font-bold text-primary hover:underline">View all</Link>
        </div>
        {(summary?.recentNotifications ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {summary?.recentNotifications.slice(0, 5).map((n) => (
              <div
                key={n.id}
                className="flex items-center gap-3 rounded-[14px] border border-border/50 p-3 transition-colors hover:bg-accent/30"
                style={{ background: "hsl(34 40% 98% / .6)" }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-primary/10 text-sm font-extrabold text-primary">
                  {(n.contact?.name ?? n.phone).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold">{n.contact?.name ?? formatPhone(n.phone)}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{n.template?.name ?? "—"} · {formatDate(n.createdAt)}</p>
                </div>
                <StatusBadge status={n.status} />
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
