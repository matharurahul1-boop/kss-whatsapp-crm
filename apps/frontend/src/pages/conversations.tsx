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

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages.length]);

  // Auto-select first conversation
  useEffect(() => {
    if (!selectedPhone && convList?.items[0]) {
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

  const selectedConv = convList?.items.find((c) => c.phone === selectedPhone);
  const windowActive = detail?.windowActive ?? false;
  const windowLeft = windowTimeLeft(detail?.windowExpiresAt ?? null);

  return (
    <div className="flex flex-col gap-0 h-[calc(100vh-7rem)]">
      <PageHeader
        title="Conversations"
        description="Incoming WhatsApp messages and reply threads."
        actions={
          <Button variant="outline" size="sm" onClick={() => { qc.invalidateQueries({ queryKey: ["conversations"] }); qc.invalidateQueries({ queryKey: ["conversation-detail", selectedPhone] }); }}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      <div className="flex flex-1 overflow-hidden rounded-xl border border-border shadow-sm mt-2">
        {/* Sidebar: conversation list */}
        <div className="w-72 shrink-0 flex flex-col border-r border-border bg-card">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
              <div key={i} className="flex gap-3 p-3 border-b border-border">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}

            {!listLoading && convList?.items.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 px-4 text-center">
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
                  className={`w-full flex gap-3 p-3 border-b border-border text-left hover:bg-secondary/50 transition-colors ${isSelected ? "bg-primary/8 border-l-2 border-l-primary" : ""}`}
                  onClick={() => setSelectedPhone(conv.phone)}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-semibold text-sm">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-medium truncate">{name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(conv.lastMessageAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {lastMsg?.body ?? (lastMsg ? `[${lastMsg.type}]` : "No messages yet")}
                    </p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="h-5 min-w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1 shrink-0">
                      {conv.unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-card min-w-0">
          {!selectedPhone ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <MessageSquare className="h-12 w-12 opacity-20" />
              <p className="text-sm">Select a conversation to view messages</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                  {(selectedConv?.contact?.name ?? selectedConv?.phone ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{selectedConv?.contact?.name ?? selectedConv?.phone}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{selectedConv?.phone}</span>
                    {windowLeft && (
                      <span className={`flex items-center gap-1 ${windowActive ? "text-green-600" : "text-destructive"}`}>
                        <Clock className="h-3 w-3" />
                        {windowActive ? `Reply window: ${windowLeft}` : "Window closed"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                {detailLoading && Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                    <Skeleton className="h-12 w-48 rounded-2xl" />
                  </div>
                ))}

                {!detailLoading && detail?.messages.length === 0 && (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">No messages in this conversation yet.</p>
                  </div>
                )}

                {detail?.messages.map((msg) => {
                  const isOut = msg.direction === "OUTBOUND";
                  return (
                    <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[72%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        isOut
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-secondary text-foreground rounded-tl-sm"
                      }`}>
                        {msg.type !== "TEXT" && msg.type !== "UNKNOWN" && (
                          <p className="text-xs opacity-70 mb-1 uppercase tracking-wide">[{msg.type}]</p>
                        )}
                        <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.body ?? `[${msg.type}]`}</p>
                        <div className={`flex items-center gap-1 mt-1 text-[10px] ${isOut ? "opacity-70 justify-end" : "opacity-50"}`}>
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
              <div className="p-3 border-t border-border">
                {!windowActive && detail?.windowExpiresAt !== undefined && (
                  <p className="text-xs text-destructive text-center mb-2">
                    24-hour reply window has closed. Send a template message to re-open the conversation.
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
      </div>
    </div>
  );
}
