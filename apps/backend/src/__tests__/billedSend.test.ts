import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ reserve: vi.fn(), refund: vi.fn(), send: vi.fn(), link: vi.fn() }));
vi.mock("../config/env", () => ({ env: { metaMode: "mock" } }));
vi.mock("../lib/prisma", () => ({ prisma: { walletTransaction: { update: mocks.link } } }));
vi.mock("../services/walletService", () => ({ reserveTemplateCost: mocks.reserve, refundTemplateCost: mocks.refund }));
vi.mock("../services/whatsapp/MockWhatsAppService", () => ({ MockWhatsAppService: class { sendMessage = mocks.send; } }));
import { getWhatsAppService } from "../services/whatsapp";
import { ApiError } from "../middleware/errorHandler";
const input = { phone: "919999999999", templateName: "offer", language: "en", variables: {} };
beforeEach(() => {
 vi.clearAllMocks();
 mocks.reserve.mockResolvedValue({ id: "debit-1" });
 mocks.send.mockResolvedValue({ status: "sent", messageId: "wamid.1" });
});
describe("shared template send billing", () => {
 it("blocks the provider when balance is insufficient", async () => {
   mocks.reserve.mockRejectedValueOnce(new ApiError(402, "INSUFFICIENT_BALANCE", "Please top up"));
   expect(await getWhatsAppService().sendMessage(input)).toMatchObject({ status: "failed", failReason: "Please top up" });
   expect(mocks.send).not.toHaveBeenCalled();
 });
 it("links successful sends to their debit without refund", async () => {
   await getWhatsAppService().sendMessage(input);
   expect(mocks.link).toHaveBeenCalledWith({ where: { id: "debit-1" }, data: { messageId: "wamid.1" } });
   expect(mocks.refund).not.toHaveBeenCalled();
 });
 it("refunds a provider rejection", async () => {
   mocks.send.mockResolvedValueOnce({ status: "failed", messageId: "", failReason: "Rejected" });
   await getWhatsAppService().sendMessage(input);
   expect(mocks.refund).toHaveBeenCalledWith("debit-1");
 });
 it("refunds when the provider throws", async () => {
   mocks.send.mockRejectedValueOnce(new Error("Provider unavailable"));
   await expect(getWhatsAppService().sendMessage(input)).rejects.toThrow("Provider unavailable");
   expect(mocks.refund).toHaveBeenCalledWith("debit-1");
 });
});
