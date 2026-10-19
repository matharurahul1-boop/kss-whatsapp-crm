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
export type ContactStage =
  // Pre-sale
  | "ENQUIRY" | "PROSPECT" | "VISIT_SCHEDULED" | "VISITED" | "NEGOTIATION"
  // Sales milestones
  | "PI_CREATED" | "SALES_ORDER"
  // Order production & delivery
  | "PRODUCTION" | "READY_DISPATCH" | "DISPATCHED" | "INSTALLATION" | "HANDOVER"
  // Post-sale service
  | "SERVICE_REQUEST" | "TICKET_OPEN" | "TICKET_CLOSED"
  // Terminal
  | "ON_HOLD" | "LOST";

export const STAGE_LABELS: Record<ContactStage, string> = {
  // Pre-sale
  ENQUIRY:          "Enquiry",
  PROSPECT:         "Prospect",
  VISIT_SCHEDULED:  "Visit Scheduled",
  VISITED:          "Visited",
  NEGOTIATION:      "Negotiation",
  // Sales
  PI_CREATED:       "PI Created",
  SALES_ORDER:      "Sales Order",
  // Order flow
  PRODUCTION:       "In Production",
  READY_DISPATCH:   "Ready for Dispatch",
  DISPATCHED:       "Dispatched",
  INSTALLATION:     "Installation Scheduled",
  HANDOVER:         "Handover",
  // Service
  SERVICE_REQUEST:  "Service Request",
  TICKET_OPEN:      "Ticket Open",
  TICKET_CLOSED:    "Ticket Closed",
  // Terminal
  ON_HOLD:          "On Hold",
  LOST:             "Lost",
};

export const STAGE_COLORS: Record<ContactStage, string> = {
  ENQUIRY:          "bg-blue-100   text-blue-800",
  PROSPECT:         "bg-violet-100 text-violet-800",
  VISIT_SCHEDULED:  "bg-yellow-100 text-yellow-800",
  VISITED:          "bg-amber-100  text-amber-800",
  NEGOTIATION:      "bg-orange-100 text-orange-800",
  PI_CREATED:       "bg-cyan-100   text-cyan-800",
  SALES_ORDER:      "bg-sky-100    text-sky-800",
  PRODUCTION:       "bg-indigo-100 text-indigo-800",
  READY_DISPATCH:   "bg-purple-100 text-purple-800",
  DISPATCHED:       "bg-fuchsia-100 text-fuchsia-800",
  INSTALLATION:     "bg-lime-100   text-lime-800",
  HANDOVER:         "bg-green-100  text-green-800",
  SERVICE_REQUEST:  "bg-teal-100   text-teal-800",
  TICKET_OPEN:      "bg-red-100    text-red-800",
  TICKET_CLOSED:    "bg-emerald-100 text-emerald-800",
  ON_HOLD:          "bg-stone-100  text-stone-600",
  LOST:             "bg-gray-100   text-gray-600",
};

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
  stage: ContactStage;
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
