import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Send, MessageCircle, Clock, CheckCheck, Check, Phone,
  Image, FileText, Mic, Video, ArrowLeft, Paperclip, X, RefreshCw,
  Bot, User2, Reply, BellOff, Bell,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, uploadMediaFile } from "@/lib/api";
import { Conversation, Message, MessageReplyPreview, PaginatedResult } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
}

function windowCountdown(expiresAt: string | null) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hrs}h ${mins}m`;
}

function isWindowActive(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

function isAutoMessage(msg: Message): boolean {
  return msg.direction === "OUTBOUND" && msg.type === "TEMPLATE";
}

function groupByDate(messages: Message[]): { date: string; msgs: Message[] }[] {
  const groups: { date: string; msgs: Message[] }[] = [];
  for (const msg of messages) {
    const dateKey = new Date(msg.sentAt ?? msg.createdAt).toDateString();
    const last = groups[groups.length - 1];
    if (last && last.date === dateKey) last.msgs.push(msg);
    else groups.push({ date: dateKey, msgs: [msg] });
  }
  return groups;
}

function replyPreviewLabel(r: MessageReplyPreview): string {
  if (r.body) return r.body.length > 60 ? r.body.slice(0, 60) + "…" : r.body;
  if (r.type === "IMAGE") return "📷 Image";
  if (r.type === "VIDEO") return "🎥 Video";
  if (r.type === "AUDIO") return "🎵 Audio";
  if (r.type === "DOCUMENT") return "📄 Document";
  return "Message";
}

// ─── push notifications ──────────────────────────────────────────────────────

async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function showPushNotification(title: string, body: string, icon?: string) {
  if (Notification.permission !== "granted") return;
  const n = new Notification(title, {
    body,
    icon: icon ?? "/favicon.ico",
    tag: "kss-whatsapp",
  });
  n.onclick = () => { window.focus(); n.close(); };
  setTimeout(() => n.close(), 8000);
}

// ─── tick ────────────────────────────────────────────────────────────────────

function Tick({ status }: { status: Message["status"] }) {
  if (status === "READ") return <CheckCheck className="h-3.5 w-3.5 text-sky-300 shrink-0" />;
  if (status === "DELIVERED") return <CheckCheck className="h-3.5 w-3.5 text-white/50 shrink-0" />;
  if (status === "SENT") return <Check className="h-3.5 w-3.5 text-white/50 shrink-0" />;
  if (status === "FAILED") return <span className="text-[10px] text-red-300 shrink-0 font-bold">!</span>;
  if (status === "QUEUED") return <Clock className="h-3 w-3 text-white/40 shrink-0" />;
  return null;
}

// ─── quoted message preview (inside bubble) ──────────────────────────────────

function QuotedMessage({ replyTo, isOut }: { replyTo: MessageReplyPreview; isOut: boolean }) {
  const fromMe = replyTo.direction === "OUTBOUND";
  return (
    <div className={cn(
      "rounded-lg px-2.5 py-1.5 mb-2 border-l-4 text-xs",
      isOut
        ? "bg-black/20 border-white/40 text-white/80"
        : "bg-black/5 dark:bg-white/5 border-emerald-500 text-muted-foreground"
    )}>
      <p className={cn("font-semibold text-[10px] mb-0.5", isOut ? "text-white/60" : "text-emerald-600 dark:text-emerald-400")}>
        {fromMe ? "You" : "Client"}
      </p>
      <p className="leading-snug">{replyPreviewLabel(replyTo)}</p>
    </div>
  );
}

// ─── message bubble ──────────────────────────────────────────────────────────

function MessageBubble({
  msg, senderName, onReply,
}: {
  msg: Message;
  senderName: string;
  onReply: (msg: Message) => void;
}) {
  const isOut = msg.direction === "OUTBOUND";
  const isAuto = isAutoMessage(msg);
  const time = formatTime(msg.sentAt ?? msg.createdAt);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={cn("flex items-end gap-1.5 px-3 mb-1 group", isOut ? "justify-end" : "justify-start")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Inbound avatar */}
      {!isOut && (
        <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-700 dark:text-emerald-300 text-xs font-bold shrink-0 mb-1">
          {senderName.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Reply button — appears on hover, left of outbound, right of inbound */}
      {!isOut && (
        <button
          onClick={() => onReply(msg)}
          className={cn(
            "p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all mb-1 order-last",
            hovered ? "opacity-100" : "opacity-0"
          )}
          title="Reply"
        >
          <Reply className="h-3.5 w-3.5" />
        </button>
      )}

      <div className={cn("relative max-w-[72%] flex flex-col", isOut ? "items-end" : "items-start")}>
        {/* Sender label */}
        {!isOut && (
          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 ml-2 mb-0.5">{senderName}</span>
        )}
        {/* Auto/Manual pill */}
        {isOut && (
          <span className={cn(
            "flex items-center gap-0.5 text-[9px] font-medium mb-0.5 px-1.5 py-0.5 rounded-full self-end",
            isAuto
              ? "bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-300"
              : "bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-300"
          )}>
            {isAuto ? <Bot className="h-2.5 w-2.5" /> : <User2 className="h-2.5 w-2.5" />}
            {isAuto ? "Auto" : "Manual"}
          </span>
        )}

        {/* Bubble */}
        <div className={cn(
          "relative rounded-2xl px-3 pt-2 pb-1.5 shadow-sm text-sm",
          isOut
            ? "bg-[#005c4b] dark:bg-[#025144] text-white rounded-tr-sm"
            : "bg-white dark:bg-zinc-800 text-foreground border border-border/60 rounded-tl-sm"
        )}>
          {/* Tail */}
          {isOut && <span className="absolute -right-1.5 bottom-2 w-0 h-0 border-t-[6px] border-t-transparent border-l-[8px] border-l-[#005c4b] dark:border-l-[#025144]" />}
          {!isOut && <span className="absolute -left-1.5 bottom-2 w-0 h-0 border-t-[6px] border-t-transparent border-r-[8px] border-r-white dark:border-r-zinc-800" />}

          {/* Quoted message */}
          {msg.replyTo && <QuotedMessage replyTo={msg.replyTo} isOut={isOut} />}

          {/* Template label */}
          {msg.type === "TEMPLATE" && msg.templateName && (
            <p className="text-[10px] font-semibold mb-1.5 flex items-center gap-1 text-white/60 uppercase tracking-wide">
              <FileText className="h-3 w-3" /> {msg.templateName}
            </p>
          )}

          {/* Media */}
          {msg.mediaUrl && msg.type === "IMAGE" && (
            <img src={msg.mediaUrl} alt="img" className="rounded-xl mb-1.5 max-w-[220px] max-h-[200px] object-cover w-full" />
          )}
          {msg.mediaUrl && msg.type === "VIDEO" && (
            <video src={msg.mediaUrl} controls className="rounded-xl mb-1.5 max-w-[220px] max-h-[180px] w-full" />
          )}
          {msg.mediaUrl && msg.type === "AUDIO" && (
            <audio src={msg.mediaUrl} controls className="mb-1.5 w-full max-w-[220px]" />
          )}
          {msg.mediaUrl && msg.type === "DOCUMENT" && (
            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer"
              className={cn("flex items-center gap-2 mb-1.5 p-2 rounded-lg text-xs", isOut ? "bg-white/10 text-white" : "bg-muted text-foreground")}>
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">{msg.body ?? "Document"}</span>
            </a>
          )}

          {!msg.mediaUrl && msg.type !== "TEXT" && msg.type !== "TEMPLATE" && (
            <p className="text-xs mb-1 opacity-60 capitalize">{msg.type.toLowerCase()}</p>
          )}

          {msg.body && msg.type !== "DOCUMENT" && (
            <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>
          )}
          {!msg.body && !msg.mediaUrl && (
            <p className="italic opacity-40 text-xs">Media</p>
          )}

          {/* Time + tick */}
          <div className={cn("flex items-center gap-1 mt-1 float-right ml-2 -mb-0.5", isOut ? "justify-end" : "justify-start")}>
            <span className={cn("text-[10px] leading-none", isOut ? "text-white/50" : "text-muted-foreground")}>{time}</span>
            {isOut && <Tick status={msg.status} />}
          </div>
          <div className="clear-both" />
        </div>
      </div>

      {/* Reply button for outbound — appears on hover */}
      {isOut && (
        <button
          onClick={() => onReply(msg)}
          className={cn(
            "p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all mb-1",
            hovered ? "opacity-100" : "opacity-0"
          )}
          title="Reply"
        >
          <Reply className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── date separator ──────────────────────────────────────────────────────────

function DateSeparator({ dateStr }: { dateStr: string }) {
  return (
    <div className="flex items-center justify-center my-3 px-4">
      <span className="bg-white/80 dark:bg-zinc-700/80 text-muted-foreground text-[10px] font-medium px-3 py-1 rounded-full shadow-sm border border-border/40">
        {formatDateLabel(dateStr)}
      </span>
    </div>
  );
}

// ─── types ───────────────────────────────────────────────────────────────────

type MediaType = "IMAGE" | "DOCUMENT" | "AUDIO" | "VIDEO";

function getMediaType(file: File): MediaType | null {
  if (file.type.startsWith("image/")) return "IMAGE";
  if (file.type.startsWith("video/")) return "VIDEO";
  if (file.type.startsWith("audio/")) return "AUDIO";
  if (file.type === "application/pdf" || file.type.includes("document") ||
    file.type.includes("spreadsheet") || file.type.includes("presentation") || file.type === "text/plain")
    return "DOCUMENT";
  return null;
}

interface AttachmentPreview { file: File; mediaType: MediaType; objectUrl: string }
interface ChatData { conversation: Conversation; messages: Message[]; windowActive: boolean; windowExpiresAt: string | null }
type ConvFilter = "ALL" | "UNREAD" | "ACTIVE" | "READ" | "SENT_ONLY";

const FILTER_LABELS: Record<ConvFilter, string> = {
  ALL: "All", UNREAD: "Unread", ACTIVE: "Active", READ: "Seen", SENT_ONLY: "Not Seen",
};

function filterConversations(convs: Conversation[], f: ConvFilter) {
  if (f === "ALL") return convs;
  if (f === "UNREAD") return convs.filter((c) => c.unreadCount > 0);
  if (f === "ACTIVE") return convs.filter((c) => isWindowActive(c.windowExpiresAt ?? null));
  if (f === "READ") return convs.filter((c) => c.messages?.[0]?.direction === "OUTBOUND" && c.messages[0].status === "READ");
  if (f === "SENT_ONLY") return convs.filter((c) => { const l = c.messages?.[0]; return l?.direction === "OUTBOUND" && (l.status === "SENT" || l.status === "DELIVERED"); });
  return convs;
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ConvFilter>("ALL");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [attachment, setAttachment] = useState<AttachmentPreview | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(Notification.permission === "granted");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // track last seen message id for push notification
  const lastMsgIdRef = useRef<string | null>(null);

  const { data: convData, isLoading: loadingConvs } = useQuery({
    queryKey: ["conversations", search],
    queryFn: () => api.get<PaginatedResult<Conversation>>(`/conversations?search=${encodeURIComponent(search)}&pageSize=50`),
    refetchInterval: 5000,
  });

  const { data: chatData, isLoading: loadingChat } = useQuery({
    queryKey: ["chat", selectedPhone],
    queryFn: () => api.get<ChatData>(`/conversations/${selectedPhone}/messages`),
    enabled: !!selectedPhone,
    refetchInterval: 3000,
  });

  // ── Push notification: detect new inbound message ──
  useEffect(() => {
    if (!chatData?.messages?.length) return;
    const msgs = chatData.messages;
    const latest = msgs[msgs.length - 1];
    if (!latest) return;

    if (lastMsgIdRef.current === null) {
      // first load — just record, don't notify
      lastMsgIdRef.current = latest.id;
      return;
    }

    if (latest.id !== lastMsgIdRef.current && latest.direction === "INBOUND") {
      lastMsgIdRef.current = latest.id;
      const convName = chatData.conversation?.contact?.name ?? selectedPhone ?? "Unknown";
      showPushNotification(
        `New message from ${convName}`,
        latest.body ?? "Media received",
      );
    } else if (latest.id !== lastMsgIdRef.current) {
      lastMsgIdRef.current = latest.id;
    }
  }, [chatData?.messages]);

  // ── Also notify from conversation list for OTHER conversations ──
  const prevConvSnapshotRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!convData?.items) return;
    const snapshot = prevConvSnapshotRef.current;
    for (const conv of convData.items) {
      const lastMsg = conv.messages?.[0];
      if (!lastMsg) continue;
      const prevId = snapshot.get(conv.id);
      if (prevId && prevId !== lastMsg.id && lastMsg.direction === "INBOUND" && conv.phone !== selectedPhone) {
        const name = conv.contact?.name ?? conv.phone;
        showPushNotification(`New message from ${name}`, lastMsg.body ?? "Media received");
      }
      snapshot.set(conv.id, lastMsg.id);
    }
  }, [convData?.items]);

  const replyMutation = useMutation({
    mutationFn: ({ text, replyToId }: { text: string; replyToId?: string }) =>
      api.post<Message>(`/conversations/${selectedPhone}/reply`, { text, replyToId }),
    onSuccess: () => {
      setReplyText("");
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ["chat", selectedPhone] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err: { message?: string }) => toast({ title: "Reply failed", description: err.message, variant: "destructive" }),
  });

  const mediaReplyMutation = useMutation({
    mutationFn: (p: { mediaUrl: string; mediaType: MediaType; caption?: string; filename?: string; replyToId?: string }) =>
      api.post<Message>(`/conversations/${selectedPhone}/reply-media`, p),
    onSuccess: () => {
      setAttachment(prev => { if (prev) URL.revokeObjectURL(prev.objectUrl); return null; });
      setReplyText("");
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ["chat", selectedPhone] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err: { message?: string }) => toast({ title: "Media send failed", description: err.message, variant: "destructive" }),
  });

  const openWindowMutation = useMutation({
    mutationFn: () => api.post(`/conversations/${selectedPhone}/open-window`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", selectedPhone] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast({ title: "Window opened", description: "24-hour reply window is now active." });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatData?.messages]);

  useEffect(() => () => { if (attachment) URL.revokeObjectURL(attachment.objectUrl); }, []);

  // Focus input when replying
  useEffect(() => {
    if (replyingTo) inputRef.current?.focus();
  }, [replyingTo]);

  const allConversations = convData?.items ?? [];
  const conversations = filterConversations(allConversations, filter);
  const selected = chatData?.conversation ?? null;
  const messages = chatData?.messages ?? [];
  const windowExpiresAt = chatData?.windowExpiresAt ?? null;
  const windowActive = isWindowActive(windowExpiresAt);
  const windowLeft = windowCountdown(windowExpiresAt);
  const senderName = selected?.contact?.name ?? selectedPhone ?? "";
  const grouped = groupByDate(messages);

  const counts: Record<ConvFilter, number> = {
    ALL: allConversations.length,
    UNREAD: allConversations.filter((c) => c.unreadCount > 0).length,
    ACTIVE: allConversations.filter((c) => isWindowActive(c.windowExpiresAt ?? null)).length,
    READ: allConversations.filter((c) => c.messages?.[0]?.direction === "OUTBOUND" && c.messages[0].status === "READ").length,
    SENT_ONLY: allConversations.filter((c) => { const l = c.messages?.[0]; return l?.direction === "OUTBOUND" && (l.status === "SENT" || l.status === "DELIVERED"); }).length,
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    if (selectedPhone) queryClient.invalidateQueries({ queryKey: ["chat", selectedPhone] });
  };

  const handleReply = useCallback((msg: Message) => {
    setReplyingTo(msg);
  }, []);

  const cancelReply = () => setReplyingTo(null);

  const handleSend = async () => {
    if (!windowActive || isUploading) return;
    const replyToId = replyingTo?.id;
    if (attachment) {
      setIsUploading(true);
      try {
        const publicUrl = await uploadMediaFile(attachment.file);
        mediaReplyMutation.mutate({ mediaUrl: publicUrl, mediaType: attachment.mediaType, caption: replyText.trim() || undefined, filename: attachment.file.name, replyToId });
      } catch {
        toast({ title: "Upload failed", description: "Could not upload the file.", variant: "destructive" });
      } finally {
        setIsUploading(false);
      }
      return;
    }
    if (!replyText.trim()) return;
    replyMutation.mutate({ text: replyText.trim(), replyToId });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mediaType = getMediaType(file);
    if (!mediaType) { toast({ title: "Unsupported file type", variant: "destructive" }); return; }
    if (attachment) URL.revokeObjectURL(attachment.objectUrl);
    setAttachment({ file, mediaType, objectUrl: URL.createObjectURL(file) });
    e.target.value = "";
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifEnabled(granted);
    if (granted) toast({ title: "Notifications enabled", description: "You'll be notified when a new message arrives." });
    else toast({ title: "Permission denied", description: "Allow notifications in browser settings.", variant: "destructive" });
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-border shadow-sm">

      {/* ── LEFT: Conversation list ── */}
      <div className={cn("flex flex-col bg-card border-r border-border", selectedPhone ? "hidden sm:flex sm:w-72 lg:w-80" : "flex w-full sm:w-72 lg:w-80")}>
        <div className="px-4 pt-4 pb-3 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold tracking-tight">Chats</h2>
            <div className="flex items-center gap-1">
              {/* Notification toggle */}
              <button
                onClick={handleEnableNotifications}
                title={notifEnabled ? "Notifications on" : "Enable notifications"}
                className={cn("p-1.5 rounded-lg transition-colors", notifEnabled ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" : "text-muted-foreground hover:bg-accent")}
              >
                {notifEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
              </button>
              <button onClick={handleRefresh} title="Refresh" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search or start a new chat" className="pl-9 h-9 text-sm bg-muted/40 border-0 focus-visible:ring-1" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {(Object.keys(FILTER_LABELS) as ConvFilter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn("shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all", filter === f ? "bg-emerald-600 text-white border-emerald-600" : "text-muted-foreground border-border hover:bg-accent")}>
                {FILTER_LABELS[f]}{counts[f] > 0 && filter !== f && <span className="ml-1 opacity-60">{counts[f]}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {loadingConvs && (
            <div className="p-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3 items-center">
                  <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-3 w-40" /></div>
                </div>
              ))}
            </div>
          )}
          {!loadingConvs && conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">{filter === "ALL" ? "No conversations yet" : `No ${FILTER_LABELS[filter].toLowerCase()} conversations`}</p>
            </div>
          )}
          {conversations.map((conv) => {
            const lastMsg = conv.messages?.[0];
            const isActive = conv.phone === selectedPhone;
            const name = conv.contact?.name ?? conv.phone;
            const convWindowActive = isWindowActive(conv.windowExpiresAt ?? null);
            return (
              <button key={conv.id} onClick={() => setSelectedPhone(conv.phone)}
                className={cn("w-full flex gap-3 items-center px-4 py-3 text-left transition-colors hover:bg-accent/60", isActive && "bg-accent")}>
                <div className="relative shrink-0">
                  <div className="h-11 w-11 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <span className={cn("absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card", convWindowActive ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-600")} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center gap-1 mb-0.5">
                    <span className="text-sm font-semibold truncate">{name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(conv.lastMessageAt)}</span>
                  </div>
                  <div className="flex justify-between items-center gap-1">
                    <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      {lastMsg?.direction === "OUTBOUND" && (
                        <>
                          {lastMsg.status === "READ" && <CheckCheck className="h-3 w-3 text-sky-400 shrink-0" />}
                          {lastMsg.status === "DELIVERED" && <CheckCheck className="h-3 w-3 text-muted-foreground shrink-0" />}
                          {lastMsg.status === "SENT" && <Check className="h-3 w-3 text-muted-foreground shrink-0" />}
                        </>
                      )}
                      <span className="truncate">{lastMsg?.body ?? (lastMsg?.type ? `📎 ${lastMsg.type.toLowerCase()}` : "No messages")}</span>
                    </span>
                    {conv.unreadCount > 0 && (
                      <span className="h-5 min-w-5 px-1 rounded-full bg-emerald-500 text-[10px] font-bold text-white flex items-center justify-center shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT: Chat window ── */}
      <div className={cn("flex-1 flex flex-col", !selectedPhone && "hidden sm:flex")}>
        {!selectedPhone ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageCircle className="h-10 w-10 opacity-30" />
            </div>
            <p className="text-base font-semibold">KSS WhatsApp</p>
            <p className="text-sm mt-1 opacity-60">Select a conversation to start chatting</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shadow-sm z-10">
              <button className="sm:hidden p-1 -ml-1 rounded text-muted-foreground hover:text-foreground" onClick={() => setSelectedPhone(null)}>
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold text-base shrink-0 shadow-sm">
                {senderName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{senderName}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedPhone}</p>
              </div>
              <div className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold shrink-0",
                windowActive ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400")}>
                <span className={cn("h-2 w-2 rounded-full", windowActive ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                {windowActive ? (windowLeft ? `Active · ${windowLeft}` : "Active") : "Closed"}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto py-2"
              style={{ background: "repeating-linear-gradient(0deg,transparent,transparent 27px,color-mix(in srgb,currentColor 3%,transparent) 27px,color-mix(in srgb,currentColor 3%,transparent) 28px)", backgroundColor: "hsl(var(--muted)/0.3)" }}>
              {loadingChat && (
                <div className="space-y-4 p-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                      <Skeleton className={cn("h-10 rounded-2xl", i % 2 === 0 ? "w-48" : "w-36")} />
                    </div>
                  ))}
                </div>
              )}
              {!loadingChat && messages.length === 0 && (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No messages yet</div>
              )}
              {grouped.map(({ msgs }) => (
                <div key={msgs[0].id}>
                  <DateSeparator dateStr={msgs[0].sentAt ?? msgs[0].createdAt} />
                  {msgs.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} senderName={senderName} onReply={handleReply} />
                  ))}
                </div>
              ))}
              <div ref={messagesEndRef} className="h-2" />
            </div>

            {/* Reply box */}
            <div className="px-3 py-2.5 border-t border-border bg-card">
              {!windowActive ? (
                <div className="flex items-center justify-between gap-3 py-2 px-3 text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    24h window closed — send a template to re-open
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs shrink-0 border-amber-300"
                    onClick={() => openWindowMutation.mutate()} disabled={openWindowMutation.isPending}>
                    Open Window
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* Quote reply preview */}
                  {replyingTo && (
                    <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2 border-l-4 border-emerald-500">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5">
                          {replyingTo.direction === "INBOUND" ? senderName : "You"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{replyPreviewLabel({ id: replyingTo.id, body: replyingTo.body, type: replyingTo.type, direction: replyingTo.direction, mediaType: replyingTo.mediaType })}</p>
                      </div>
                      <button onClick={cancelReply} className="p-1 rounded-full hover:bg-muted text-muted-foreground shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Attachment preview */}
                  {attachment && (
                    <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-2">
                      {attachment.mediaType === "IMAGE"
                        ? <img src={attachment.objectUrl} alt="preview" className="h-12 w-12 object-cover rounded-lg shrink-0" />
                        : <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            {attachment.mediaType === "VIDEO" && <Video className="h-5 w-5 text-muted-foreground" />}
                            {attachment.mediaType === "AUDIO" && <Mic className="h-5 w-5 text-muted-foreground" />}
                            {attachment.mediaType === "DOCUMENT" && <FileText className="h-5 w-5 text-muted-foreground" />}
                          </div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{attachment.file.name}</p>
                        <p className="text-[10px] text-muted-foreground">{(attachment.file.size / 1024).toFixed(0)} KB · {attachment.mediaType.toLowerCase()}</p>
                      </div>
                      <button onClick={() => { if (attachment) URL.revokeObjectURL(attachment.objectUrl); setAttachment(null); }}
                        className="p-1 rounded-full hover:bg-muted text-muted-foreground shrink-0"><X className="h-4 w-4" /></button>
                    </div>
                  )}

                  {isUploading && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 px-1">
                      <RefreshCw className="h-3 w-3 animate-spin" /> Uploading…
                    </div>
                  )}

                  <div className="flex gap-2 items-center">
                    <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" className="hidden" onChange={handleFileSelect} />
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="shrink-0 h-10 w-10 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                      <Paperclip className="h-5 w-5" />
                    </button>
                    <Input
                      ref={inputRef}
                      placeholder={attachment ? "Add a caption…" : replyingTo ? "Type a reply…" : "Type a message"}
                      className="flex-1 rounded-full bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-emerald-500/50 h-10"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                        if (e.key === "Escape") cancelReply();
                      }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={(!replyText.trim() && !attachment) || replyMutation.isPending || mediaReplyMutation.isPending || isUploading}
                      className={cn("shrink-0 h-10 w-10 rounded-full flex items-center justify-center transition-all",
                        (!replyText.trim() && !attachment) || replyMutation.isPending || isUploading
                          ? "bg-muted text-muted-foreground"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                      )}
                    >
                      {replyMutation.isPending || mediaReplyMutation.isPending || isUploading
                        ? <RefreshCw className="h-4 w-4 animate-spin" />
                        : <Send className="h-4 w-4" />
                      }
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
