import { Prisma, TemplateCategory } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getOrCreateWallet } from "./walletService";
import { ApiError } from "../middleware/errorHandler";

export async function estimateCampaignCost(category: TemplateCategory, recipients: number) {
  const [wallet, rate] = await Promise.all([
    getOrCreateWallet(),
    prisma.messageRate.findUnique({ where: { category_hasMedia: { category, hasMedia: false } } }),
  ]);
  const cost = rate ? rate.rateInr.mul(recipients) : null;
  return {
    category, recipients, rateInr: rate ? Number(rate.rateInr) : null,
    estimatedCost: cost == null ? null : Number(cost), availableBalance: Number(wallet.balance),
    balanceAfter: cost == null ? null : Number(wallet.balance.minus(cost)),
    shortfall: cost == null ? null : Number(Prisma.Decimal.max(cost.minus(wallet.balance), 0)),
    canSend: cost != null && wallet.balance.gte(cost) && recipients > 0,
  };
}

export async function estimateExistingCampaign(id: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id }, include: { template: true } });
  if (!campaign) throw new ApiError(404, "NOT_FOUND", "Campaign not found");
  const recipients = await prisma.campaignRecipient.count({ where: { campaignId: id, status: "PENDING" } });
  return estimateCampaignCost(campaign.template.category, recipients);
}
