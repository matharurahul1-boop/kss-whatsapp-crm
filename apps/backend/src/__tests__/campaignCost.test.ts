import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const db = vi.hoisted(() => ({ messageRate: { findUnique: vi.fn() }, campaign: { findUnique: vi.fn() }, campaignRecipient: { count: vi.fn() } }));
const wallet = vi.hoisted(() => vi.fn());
vi.mock("../lib/prisma", () => ({ prisma: db }));
vi.mock("../services/walletService", () => ({ getOrCreateWallet: wallet }));
import { estimateCampaignCost, estimateExistingCampaign } from "../services/campaignCostService";
beforeEach(() => { vi.clearAllMocks(); wallet.mockResolvedValue({ balance: new Prisma.Decimal(2000) }); db.messageRate.findUnique.mockResolvedValue({ rateInr: new Prisma.Decimal("0.85") }); });
describe("campaign cost preview", () => {
 it("uses precise current category pricing and balance", async () => {
  expect(await estimateCampaignCost("MARKETING", 1000)).toMatchObject({ estimatedCost: 850, availableBalance: 2000, balanceAfter: 1150, shortfall: 0, canSend: true });
 });
 it("reports shortfall and refuses insufficient balances", async () => {
  wallet.mockResolvedValue({ balance: new Prisma.Decimal(20) });
  expect(await estimateCampaignCost("MARKETING", 100)).toMatchObject({ estimatedCost: 85, shortfall: 65, canSend: false });
 });
 it("does not guess prices for an unconfigured category", async () => {
  db.messageRate.findUnique.mockResolvedValue(null);
  expect(await estimateCampaignCost("UTILITY", 100)).toMatchObject({ rateInr: null, estimatedCost: null, canSend: false });
 });
 it("permits a free campaign but not an empty campaign", async () => {
  db.messageRate.findUnique.mockResolvedValue({ rateInr: new Prisma.Decimal(0) });
  expect((await estimateCampaignCost("UTILITY", 10)).canSend).toBe(true);
  expect((await estimateCampaignCost("UTILITY", 0)).canSend).toBe(false);
 });
 it("counts only pending recipients in saved campaigns", async () => {
  db.campaign.findUnique.mockResolvedValue({ template: { category: "UTILITY" } }); db.campaignRecipient.count.mockResolvedValue(2);
  expect((await estimateExistingCampaign("c1")).recipients).toBe(2);
  expect(db.campaignRecipient.count).toHaveBeenCalledWith({ where: { campaignId: "c1", status: "PENDING" } });
 });
});
