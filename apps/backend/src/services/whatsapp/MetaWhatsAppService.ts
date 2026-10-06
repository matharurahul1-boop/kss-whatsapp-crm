import { env } from "../../config/env";
import { ConnectAccountResult, MetaTemplate, SendMessageResult, TemplateSyncResult, WhatsAppService } from "./WhatsAppService";

const GRAPH_BASE = "https://graph.facebook.com/v20.0";

// Real Meta Cloud API integration. Requires valid credentials in env vars.
export class MetaWhatsAppService implements WhatsAppService {
  readonly mode = "live" as const;

  async connectAccount(): Promise<ConnectAccountResult> {
    const res = await fetch(`${GRAPH_BASE}/${env.phoneNumberId}?fields=display_phone_number,quality_rating,verified_name`, {
      headers: { Authorization: `Bearer ${env.accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Failed to connect to Meta WhatsApp API: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { verified_name?: string; display_phone_number?: string; quality_rating?: string };
    return {
      businessName: data.verified_name ?? "Unknown",
      wabaId: env.wabaId,
      phoneNumberId: env.phoneNumberId,
      displayPhoneNumber: data.display_phone_number ?? "",
      qualityRating: data.quality_rating ?? "UNKNOWN",
    };
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.connectAccount();
      return { ok: true, message: "Connected to Meta WhatsApp Business API." };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  async submitTemplate(input: { name: string; category: string; language: string; body: string }): Promise<TemplateSyncResult> {
    const res = await fetch(`${GRAPH_BASE}/${env.wabaId}/message_templates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        category: input.category,
        language: input.language,
        components: [{ type: "BODY", text: input.body }],
      }),
    });
    if (!res.ok) {
      return { status: "rejected", rejectionReason: await res.text() };
    }
    return { status: "pending" };
  }

  async fetchTemplates(): Promise<MetaTemplate[]> {
    const res = await fetch(
      `${GRAPH_BASE}/${env.wabaId}/message_templates?fields=name,category,language,status,rejected_reason,components&limit=100`,
      { headers: { Authorization: `Bearer ${env.accessToken}` } }
    );
    if (!res.ok) throw new Error(`Failed to fetch templates: ${res.status} ${await res.text()}`);

    const data = (await res.json()) as {
      data: Array<{
        name: string;
        category: string;
        language: string;
        status: string;
        rejected_reason?: string;
        components?: Array<{ type: string; format?: string; text?: string; example?: { header_text?: string[] } }>;
      }>;
    };

    return data.data.map((t) => {
      const header = t.components?.find((c) => c.type === "HEADER");
      const body = t.components?.find((c) => c.type === "BODY");
      const footer = t.components?.find((c) => c.type === "FOOTER");
      const bodyText = body?.text ?? "";
      const variableCount = (bodyText.match(/\{\{\d+\}\}/g) ?? []).length;

      let headerType = "NONE";
      let headerContent: string | null = null;
      if (header) {
        headerType = header.format ?? "TEXT";
        headerContent = header.text ?? header.example?.header_text?.[0] ?? null;
      }

      return {
        name: t.name,
        category: t.category,
        language: t.language,
        status: t.status,
        rejectionReason: t.rejected_reason,
        headerType,
        headerContent,
        body: bodyText,
        footer: footer?.text ?? null,
        variableCount,
      };
    });
  }

  async sendMessage(input: { phone: string; templateName: string; language: string; variables: Record<string, string> }): Promise<SendMessageResult> {
    const res = await fetch(`${GRAPH_BASE}/${env.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.phone,
        type: "template",
        template: {
          name: input.templateName,
          language: { code: input.language },
          components: [
            {
              type: "body",
              parameters: Object.values(input.variables).map((value) => ({ type: "text", text: value })),
            },
          ],
        },
      }),
    });
    const data = (await res.json()) as { messages?: { id: string }[]; error?: { message: string } };
    if (!res.ok || !data.messages?.[0]) {
      return { messageId: "", status: "failed", failReason: data.error?.message ?? "Unknown error from Meta API" };
    }
    return { messageId: data.messages[0].id, status: "sent" };
  }
}
