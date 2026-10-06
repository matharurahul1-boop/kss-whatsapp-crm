import { env } from "../../config/env";
import { MetaWhatsAppService } from "./MetaWhatsAppService";
import { MockWhatsAppService } from "./MockWhatsAppService";
import { WhatsAppService } from "./WhatsAppService";

let instance: WhatsAppService | null = null;

export function getWhatsAppService(): WhatsAppService {
  if (!instance) {
    instance = env.metaMode === "live" ? new MetaWhatsAppService() : new MockWhatsAppService();
  }
  return instance;
}

export * from "./WhatsAppService";
