import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
 contact: { findMany: vi.fn() }, stageTemplate: { findUnique: vi.fn() }, whatsAppTemplate: { findUnique: vi.fn() },
 notification: { createMany: vi.fn(), update: vi.fn() }, auditLog: { create: vi.fn() }, $transaction: vi.fn(), $queryRaw: vi.fn(),
}));
const send = vi.hoisted(() => vi.fn()); const estimate = vi.hoisted(() => vi.fn()); const record = vi.hoisted(() => vi.fn());
vi.mock("../lib/prisma", () => ({ prisma: db }));
vi.mock("../services/whatsapp", () => ({ getWhatsAppService: () => ({ sendMessage: send }) }));
vi.mock("../services/campaignCostService", () => ({ estimateCampaignCost: estimate }));
vi.mock("../services/conversationService", () => ({ recordOutboundMessage: record }));
vi.mock("../services/messageSimulator", () => ({ scheduleMockDeliveryProgression: vi.fn() }));
vi.mock("../config/env", () => ({ env: { metaMode: "mock" } }));
import { applyBulkStage, previewBulkStage, bulkStageSchema } from "../services/bulkStageService";
const leads = [
 { id: "a", name: "Asha", phone: "919876543210", stage: "ENQUIRY" },
 { id: "b", name: "Bharat", phone: "919876543211", stage: "ENQUIRY" },
 { id: "c", name: "Chirag", phone: "919876543212", stage: "PROSPECT" },
];
const input = bulkStageSchema.parse({ ids: ["a", "b", "c"], stage: "PROSPECT" });
beforeEach(() => {
 vi.resetAllMocks(); db.contact.findMany.mockResolvedValue(leads);
 db.stageTemplate.findUnique.mockResolvedValue({ enabled: true, templateName: "prospect_update", language: "en" });
 db.whatsAppTemplate.findUnique.mockResolvedValue({ id: "tpl", name: "prospect_update", status: "APPROVED", category: "UTILITY", body: "Hello {{1}}", variableCount: 1 });
 estimate.mockResolvedValue({ recipients: 2, rateInr: 0.4, estimatedCost: 0.8, availableBalance: 2000, canSend: true });
 db.$transaction.mockImplementation((fn) => fn(db)); db.$queryRaw.mockResolvedValue(leads.slice(0, 2));
 send.mockImplementation(async ({ phone }) => ({ status: "sent", messageId: "wamid." + phone }));
});
describe("bulk stage update and automatic templates", () => {
 it("previews changed recipients, unchanged leads and category-priced cost", async () => {
  const preview = await previewBulkStage(input);
  expect(preview).toMatchObject({ selected: 3, changed: 2, unchanged: 1, messagesToSend: 2, templateName: "prospect_update", canApply: true });
  expect(estimate).toHaveBeenCalledWith("UTILITY", 2); expect(db.$transaction).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
 });
 it("updates once and sends each changed contact the stage template with their name", async () => {
  const result = await applyBulkStage(input, "admin");
  expect(result).toMatchObject({ updated: 2, unchanged: 1, sent: 2, failed: 0, skipped: 0 });
  expect(send).toHaveBeenCalledTimes(2);
  expect(send).toHaveBeenCalledWith({ phone: leads[0].phone, templateName: "prospect_update", language: "en", variables: { "1": "Asha" } });
  expect(send).toHaveBeenCalledWith({ phone: leads[1].phone, templateName: "prospect_update", language: "en", variables: { "1": "Bharat" } });
  expect(db.notification.createMany.mock.calls[0][0].data).toHaveLength(2); expect(record).toHaveBeenCalledTimes(2);
 });
 it("does not resend or change leads already in the destination stage", async () => {
  db.contact.findMany.mockResolvedValue(leads.map((lead) => ({ ...lead, stage: "PROSPECT" })));
  expect(await applyBulkStage(input, "admin")).toMatchObject({ updated: 0, unchanged: 3, sent: 0 });
  expect(send).not.toHaveBeenCalled(); expect(db.$transaction).not.toHaveBeenCalled();
 });
 it("does not send twice when a concurrent update has already claimed the contacts", async () => {
  db.$queryRaw.mockResolvedValue([]);
  expect(await applyBulkStage(input, "admin")).toMatchObject({ updated: 0, sent: 0 }); expect(send).not.toHaveBeenCalled();
 });
 it("blocks insufficient credit before any stage changes", async () => {
  estimate.mockResolvedValue({ rateInr: 0.4, canSend: false, shortfall: 0.8 });
  await expect(applyBulkStage(input, "admin")).rejects.toMatchObject({ status: 402, code: "BULK_STAGE_BLOCKED" });
  expect(db.$transaction).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
 });
 it("requires an approved assigned template", async () => {
  db.whatsAppTemplate.findUnique.mockResolvedValue({ status: "PENDING" });
  await expect(applyBulkStage(input, "admin")).rejects.toMatchObject({ code: "BULK_STAGE_BLOCKED" });
  expect(db.$transaction).not.toHaveBeenCalled();
 });
 it("explains missing automation and supports stage-only updates", async () => {
  db.stageTemplate.findUnique.mockResolvedValue(null);
  expect(await previewBulkStage(input)).toMatchObject({ automationEnabled: false, messagesToSend: 0, canApply: true });
  expect(await applyBulkStage(input, "admin")).toMatchObject({ updated: 2, sent: 0, skipped: 2 }); expect(send).not.toHaveBeenCalled();
 });
 it("updates invalid-phone leads but skips sending to them", async () => {
  const contacts = [{ ...leads[0], phone: "invalid" }, leads[1], leads[2]];
  db.contact.findMany.mockResolvedValue(contacts); db.$queryRaw.mockResolvedValue(contacts.slice(0, 2));
  expect(await previewBulkStage(input)).toMatchObject({ invalidPhones: 1, messagesToSend: 1 });
  expect(await applyBulkStage(input, "admin")).toMatchObject({ updated: 2, sent: 1, skipped: 1 }); expect(send).toHaveBeenCalledTimes(1);
 });
 it("reports provider failures without treating them as sent", async () => {
  send.mockResolvedValue({ status: "failed", messageId: "", failReason: "Provider rejected message" });
  expect(await applyBulkStage(input, "admin")).toMatchObject({ updated: 2, sent: 0, failed: 2 });
  expect(record).not.toHaveBeenCalled(); expect(db.notification.update.mock.calls[0][0].data).toMatchObject({ status: "FAILED", messageId: null });
 });
 it("captures provider exceptions as failed results", async () => {
  send.mockRejectedValue(new Error("network error"));
  expect(await applyBulkStage(input, "admin")).toMatchObject({ updated: 2, sent: 0, failed: 2 }); expect(record).not.toHaveBeenCalled();
 });
 it("rejects missing contacts before modifying existing ones", async () => {
  db.contact.findMany.mockResolvedValue(leads.slice(0, 1));
  await expect(applyBulkStage(input, "admin")).rejects.toMatchObject({ code: "CONTACTS_NOT_FOUND" }); expect(db.$transaction).not.toHaveBeenCalled();
 });
 it("deduplicates selected IDs and validates the stage and batch limit", () => {
  expect(bulkStageSchema.parse({ ids: ["a", "a"], stage: "PROSPECT" }).ids).toEqual(["a"]);
  expect(() => bulkStageSchema.parse({ ids: [], stage: "PROSPECT" })).toThrow();
  expect(() => bulkStageSchema.parse({ ids: Array.from({ length: 201 }, (_, i) => String(i)), stage: "PROSPECT" })).toThrow();
  expect(() => bulkStageSchema.parse({ ids: ["a"], stage: "FAKE" })).toThrow();
 });
});
