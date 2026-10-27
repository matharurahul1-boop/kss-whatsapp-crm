import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Search, Send, RefreshCw, Phone, User, Clock, CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

interface Conversation {
  id: string;
  phone: string;
  unreadCount: number;
  lastMessageAt: string | null;
  windowExpiresAt: string | null;
  contact: { id: string; name: string } | null;
  messages: Message[];
}

interface Message {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  type: string;
  body: string | null;
  status: string;
  sentAt: string;
  createdAt: string;
}

interface ConvDetail {
  conversation: Conversation;
  messages: Message[];
  total: number;
  windowActive: boolean;
  windowExpiresAt: string | null;
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function windowTimeLeft(expiresAt: string | null) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const hrs = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${hrs}h ${mins}m left`;
}

export default function ConversationsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [replyText, setReplyText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: convList, isLoading: listLoading } = useQuery({
    queryKey: ["conversations", search],
    queryFn: () => api.get<{ items: Conversation[]; total: number }>(`/conversations?search=${encodeURIComponent(search)}&pageSize=50`),
    refetchInterval: 5000,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["conversation-detail", selectedPhone],
    queryFn: () => api.get<ConvDetail>(`/conversations/${encodeURIComponent(selectedPhone!)}/messages`),
    enabled: !!selectedPhone,
    refetchInterval: 3000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages.length]);

  // Auto-select first on desktop only
  useEffect(() => {
    if (!selectedPhone && convList?.items[0] && window.innerWidth >= 1024) {
      setSelectedPhone(convList.items[0].phone);
    }
  }, [convList]);

  const replyMutation = useMutation({
    mutationFn: (text: string) =>
      api.post(`/conversations/${encodeURIComponent(selectedPhone!)}/reply`, { text }),
    onSuccess: () => {
      setReplyText("");
      qc.invalidateQueries({ queryKey: ["conversation-detail", selectedPhone] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err: any) => {
      toast({ title: err?.message ?? "Failed to send reply", variant: "destructive" });
    },
  });

  const handleSend = () => {
    if (!replyText.trim() || !selectedPhone) return;
    replyMutation.mutate(replyText.trim());
  };

  const openChat = (phone: string) => {
    setSelectedPhone(phone);
    setMobileView("chat");
  };

  const goBackToList = () => {
    setMobileView("list");
  };

  const selectedConv = convList?.items.find((c) => c.phone === selectedPhone);
  const windowActive = detail?.windowActive ?? false;
  const windowLeft = windowTimeLeft(detail?.windowExpiresAt ?? null);

  // ── Shared: conversation list panel ──
  const ListPanel = (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {listLoading && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3 border-b border-border p-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}

        {!listLoading && convList?.items.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No conversations yet.</p>
            <p className="text-xs text-muted-foreground">When a contact replies to a WhatsApp message it will appear here.</p>
          </div>
        )}

        {convList?.items.map((conv) => {
          const name = conv.contact?.name ?? conv.phone;
          const lastMsg = conv.messages[0];
          const isSelected = conv.phone === selectedPhone;
          return (
            <button
              key={conv.id}
              className={`w-full flex gap-3 border-b border-border p-3 text-left transition-colors active:bg-secondary/70 hover:bg-secondary/50 ${isSelected ? "border-l-2 border-l-primary bg-primary/8" : ""}`}
              onClick={() => openChat(conv.phone)}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-semibold truncate">{name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(conv.lastMessageAt)}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {lastMsg?.body ?? (lastMsg ? `[${lastMsg.type}]` : "No messages yet")}
                </p>
              </div>
              {conv.unreadCount > 0 && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {conv.unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Shared: chat detail panel ──
  const ChatPanel = (
    <div className="flex h-full flex-col bg-card min-w-0">
      {!selectedPhone ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <MessageSquare className="h-12 w-12 opacity-20" />
          <p className="text-sm">Select a conversation to view messages</p>
        </div>
      ) : (
        <>
          {/* Chat header */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            {/* Back button — mobile only */}
            <button
              className="lg:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground active:opacity-60"
              onClick={goBackToList}
              aria-label="Back to conversations"
            >
              <User className="h-4 w-4 rotate-180" style={{ transform: "scaleX(-1)" }} />
            </button>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">
              {(selectedConv?.contact?.name ?? selectedConv?.phone ?? "?").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold">{selectedConv?.contact?.name ?? selectedConv?.phone}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{selectedConv?.phone}</span>
                {windowLeft && (
                  <span className={`flex items-center gap-1 ${windowActive ? "text-green-600" : "text-destructive"}`}>
                    <Clock className="h-3 w-3" />
                    {windowActive ? `Window: ${windowLeft}` : "Window closed"}
                  </span>
                )}
              </div>
            </div>
            <button
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary active:opacity-60"
              onClick={() => { qc.invalidateQueries({ queryKey: ["conversation-detail", selectedPhone] }); }}
              aria-label="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            {detailLoading && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                <Skeleton className="h-12 w-48 rounded-2xl" />
              </div>
            ))}

            {!detailLoading && detail?.messages.length === 0 && (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-muted-foreground">No messages in this conversation yet.</p>
              </div>
            )}

            {detail?.messages.map((msg) => {
              const isOut = msg.direction === "OUTBOUND";
              return (
                <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    isOut
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-secondary text-foreground rounded-tl-sm"
                  }`}>
                    {msg.type !== "TEXT" && msg.type !== "UNKNOWN" && (
                      <p className="mb-1 text-xs uppercase tracking-wide opacity-70">[{msg.type}]</p>
                    )}
                    <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.body ?? `[${msg.type}]`}</p>
                    <div className={`mt-1 flex items-center gap-1 text-[10px] ${isOut ? "justify-end opacity-70" : "opacity-50"}`}>
                      <span>{formatDate(msg.sentAt)}</span>
                      {isOut && <CheckCheck className="h-3 w-3" />}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Reply box */}
          <div className="border-t border-border p-3">
            {!windowActive && detail?.windowExpiresAt !== undefined && (
              <p className="mb-2 text-center text-xs text-destructive">
                24-hour reply window closed. Send a template to re-open.
              </p>
            )}
            <div className="flex gap-2">
              <Input
                placeholder={windowActive ? "Type a reply…" : "Window closed — send a template to reopen"}
                value={replyText}
                disabled={!windowActive}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                className="flex-1"
              />
              <Button
                disabled={!windowActive || !replyText.trim() || replyMutation.isPending}
                loading={replyMutation.isPending}
                onClick={handleSend}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col gap-0">
      {/* ── Desktop header (hidden on mobile when in chat) ── */}
      <div className={mobileView === "chat" ? "hidden lg:block" : ""}>
        <PageHeader
          title="Conversations"
          description="Incoming WhatsApp messages and reply threads."
          actions={
            <Button variant="outline" size="sm" onClick={() => { qc.invalidateQueries({ queryKey: ["conversations"] }); qc.invalidateQueries({ queryKey: ["conversation-detail", selectedPhone] }); }}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          }
        />
      </div>

      {/* ── Mobile: single-panel view (list or chat) ── */}
      <div className="mt-2 flex-1 overflow-hidden rounded-xl border border-border shadow-sm lg:hidden">
        {mobileView === "list" ? ListPanel : ChatPanel}
      </div>

      {/* ── Desktop: side-by-side ── */}
      <div className="mt-2 hidden flex-1 overflow-hidden rounded-xl border border-border shadow-sm lg:flex">
        <div className="w-72 shrink-0 border-r border-border bg-card">
          {ListPanel}
        </div>
        <div className="flex flex-1 flex-col min-w-0">
          {ChatPanel}
        </div>
      </div>
    </div>
  );
}
