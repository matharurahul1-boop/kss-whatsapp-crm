import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { MessageCircle, FileText, Send, CheckCheck, Plus, Megaphone } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/utils";
import { Campaign, Notification, WhatsAppAccount } from "@/lib/types";

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

function countFor(items: { status: string; count: number }[], status: string): number {
  return items.find((i) => i.status === status)?.count ?? 0;
}

export default function DashboardPage() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.get<DashboardSummary>("/dashboard/summary"),
  });

  const { data: deliveryOverview } = useQuery({
    queryKey: ["delivery-overview"],
    queryFn: () => api.get<DeliveryPoint[]>("/dashboard/delivery-overview"),
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your WhatsApp notification activity for KSS Interiors."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/campaigns/new">
                <Plus className="h-4 w-4" /> Create Campaign
              </Link>
            </Button>
            <Button asChild>
              <Link to="/send">
                <Send className="h-4 w-4" /> Send Notification
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          : cards.map((card) => (
              <Card key={card.label}>
                <CardContent className="flex items-start justify-between p-5">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                    <p className="mt-1.5 text-2xl font-semibold">{card.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <card.icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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
