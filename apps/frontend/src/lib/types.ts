export type UserRole = "ADMIN" | "MANAGER" | "AGENT";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export type WhatsAppConnectionStatus = "NOT_CONNECTED" | "CONNECTED" | "ERROR";

export interface WhatsAppAccount {
  id: string;
  status: WhatsAppConnectionStatus;
  businessName: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  qualityRating: string | null;
  lastConnectedAt: string | null;
  lastTestedAt: string | null;
  mode: "mock" | "live";
}

export type TemplateStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "DISABLED";
export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type HeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
export type ButtonType = "QUICK_REPLY" | "WEBSITE" | "PHONE";

export interface TemplateButton {
  type: ButtonType;
  label: string;
  value?: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  language: string;
  status: TemplateStatus;
  headerType: HeaderType;
  headerContent: string | null;
  body: string;
  footer: string | null;
  buttons: TemplateButton[] | null;
  rejectionReason: string | null;
  variableCount: number;
  createdAt: string;
  updatedAt: string;
}

export type ContactSource = "MANUAL" | "CRM_API" | "EXHIBITION" | "WEBSITE" | "IMPORT";

export interface ContactTag {
  id: string;
  name: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: ContactSource;
  notes: string | null;
  tags: ContactTag[];
  createdAt: string;
  updatedAt: string;
}

export type CampaignStatus = "DRAFT" | "SCHEDULED" | "PROCESSING" | "COMPLETED" | "PARTIALLY_COMPLETED" | "FAILED" | "CANCELLED";
export type CampaignAudienceType = "ALL" | "TAGS" | "IMPORTED_LIST" | "MANUAL_SELECTION";

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  audienceType: CampaignAudienceType;
  templateId: string;
  template: WhatsAppTemplate;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RecipientStatus = "PENDING" | "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "SKIPPED";

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  contactId: string;
  contact: Contact;
  status: RecipientStatus;
  variables: Record<string, string> | null;
  failReason: string | null;
  messageId: string | null;
  processedAt: string | null;
  createdAt: string;
}

export type NotificationStatus = "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
export type NotificationChannel = "SINGLE" | "CAMPAIGN" | "API";

export interface Notification {
  id: string;
  contactId: string | null;
  contact: Contact | null;
  phone: string;
  templateId: string | null;
  template: WhatsAppTemplate | null;
  campaignId: string | null;
  campaign: Campaign | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  messageId: string | null;
  variables: Record<string, string> | null;
  failReason: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  enabled: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  user: { name: string; email: string } | null;
  action: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export type MessageDirection = "INBOUND" | "OUTBOUND";
export type MessageType = "TEXT" | "TEMPLATE" | "IMAGE" | "DOCUMENT" | "AUDIO" | "VIDEO" | "STICKER" | "UNKNOWN";
export type MessageStatus = "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";

export interface MessageReplyPreview {
  id: string;
  body: string | null;
  type: MessageType;
  direction: MessageDirection;
  mediaType: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  type: MessageType;
  body: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  templateName: string | null;
  waMessageId: string | null;
  status: MessageStatus;
  failReason: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  createdAt: string;
  replyToId: string | null;
  replyTo: MessageReplyPreview | null;
}

export interface Conversation {
  id: string;
  phone: string;
  contactId: string | null;
  contact: Contact | null;
  lastMessageAt: string;
  windowExpiresAt: string | null;
  unreadCount: number;
  messages?: Message[];
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
