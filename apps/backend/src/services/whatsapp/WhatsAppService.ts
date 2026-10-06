export interface ConnectAccountResult {
  businessName: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  qualityRating: string;
}

export interface SendMessageResult {
  messageId: string;
  status: "sent" | "failed";
  failReason?: string;
}

export interface TemplateSyncResult {
  status: "approved" | "rejected" | "pending";
  rejectionReason?: string;
}

export interface MetaTemplate {
  name: string;
  category: string;
  language: string;
  status: string;
  rejectionReason?: string;
  headerType: string;
  headerContent: string | null;
  body: string;
  footer: string | null;
  variableCount: number;
}

export interface WhatsAppService {
  readonly mode: "mock" | "live";
  connectAccount(): Promise<ConnectAccountResult>;
  testConnection(): Promise<{ ok: boolean; message: string }>;
  submitTemplate(input: { name: string; category: string; language: string; body: string }): Promise<TemplateSyncResult>;
  sendMessage(input: {
    phone: string;
    templateName: string;
    language: string;
    variables: Record<string, string>;
  }): Promise<SendMessageResult>;
  fetchTemplates?(): Promise<MetaTemplate[]>;
}
