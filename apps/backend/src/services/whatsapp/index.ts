import { deductWalletCost } from "../walletService";
import { env } from "../../config/env";
import { MetaWhatsAppService } from "./MetaWhatsAppService";
import { MockWhatsAppService } from "./MockWhatsAppService";
import { WhatsAppService } from "./WhatsAppService";

let instance: WhatsAppService | null = null;

export function resetWhatsAppService() {
  instance = null;
}

export function getWhatsAppService(): WhatsAppService {
  if (!instance) {
    instance = env.metaMode === "live" ? new MetaWhatsAppService() : new MockWhatsAppService();
    const providerSend = instance.sendMessage.bind(instance);
    instance.sendMessage = async (input) => {
      const result = await providerSend(input);
      if (result.status !== "failed") {
        void deductWalletCost({
          templateName: input.templateName,
          notificationId: result.messageId ?? "",
          description: `WhatsApp message sent via template ${input.templateName}`,
        });
      }
      return result;
    };
  }
  return instance;
}

export * from "./WhatsAppService";
