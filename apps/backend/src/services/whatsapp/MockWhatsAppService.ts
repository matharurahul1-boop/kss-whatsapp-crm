import { nanoid } from "nanoid";
import { ConnectAccountResult, SendMessageResult, TemplateSyncResult, WhatsAppService } from "./WhatsAppService";

function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
}

export class MockWhatsAppService implements WhatsAppService {
  readonly mode = "mock" as const;

  async connectAccount(): Promise<ConnectAccountResult> {
    await sleep(randomDelay(300, 800));
    return {
      businessName: "KSS Interiors",
      wabaId: `waba_${nanoid(10)}`,
      phoneNumberId: `phn_${nanoid(10)}`,
      displayPhoneNumber: "+91 98765 43210",
      qualityRating: "GREEN",
    };
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    await sleep(randomDelay(200, 500));
    return { ok: true, message: "Mock connection healthy. No real Meta API call was made." };
  }

  async submitTemplate(): Promise<TemplateSyncResult> {
    await sleep(randomDelay(300, 700));
    const roll = Math.random();
    if (roll < 0.65) {
      return { status: "approved" };
    }
    if (roll < 0.85) {
      return { status: "pending" };
    }
    const reasons = [
      "Template contains promotional language not permitted in utility category.",
      "Variable placeholders do not match sample content provided.",
      "Header media format not supported for this template category.",
      "Body text closely matches an existing disapproved template.",
    ];
    return { status: "rejected", rejectionReason: reasons[Math.floor(Math.random() * reasons.length)] };
  }

  async sendMessage(): Promise<SendMessageResult> {
    await sleep(randomDelay(150, 500));
    const messageId = `wamid.mock.${nanoid(20)}`;
    const willFail = Math.random() < 0.06;
    if (willFail) {
      const reasons = [
        "Recipient phone number is not a valid WhatsApp account.",
        "Message failed to send due to recipient opt-out.",
        "Template pacing limit reached for this recipient.",
      ];
      return { messageId, status: "failed", failReason: reasons[Math.floor(Math.random() * reasons.length)] };
    }
    return { messageId, status: "sent" };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
