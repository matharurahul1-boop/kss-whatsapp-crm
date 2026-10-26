import { ApiError } from "../../middleware/errorHandler";
import { prisma } from "../../lib/prisma";
import { reserveTemplateCost, refundTemplateCost } from "../walletService";
import { env } from "../../config/env";
import { MetaWhatsAppService } from "./MetaWhatsAppService";
import { MockWhatsAppService } from "./MockWhatsAppService";
import { WhatsAppService } from "./WhatsAppService";

let instance: WhatsAppService | null = null;

export function getWhatsAppService(): WhatsAppService {
  if (!instance) {
    instance = env.metaMode === "live" ? new MetaWhatsAppService() : new MockWhatsAppService();
    const providerSend = instance.sendMessage.bind(instance);
    instance.sendMessage = async (input) => {
      let debit;
      try { debit = await reserveTemplateCost(input.templateName, input.phone); }
      catch (error) {
        if (error instanceof ApiError) return { messageId: "", status: "failed", failReason: error.message };
        throw error;
      }
      let result;
      try { result = await providerSend(input); }
      catch (error) { await refundTemplateCost(debit.id); throw error; }
      if (result.status === "failed") await refundTemplateCost(debit.id);
      else await prisma.walletTransaction.update({ where: { id: debit.id }, data: { messageId: result.messageId } });
      return result;
    };
  }
  return instance;
}

export * from "./WhatsAppService";
