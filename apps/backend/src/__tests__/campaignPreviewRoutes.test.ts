import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ template: vi.fn(), contacts: vi.fn(), campaign: vi.fn(), estimate: vi.fn(), existing: vi.fn(), enqueue: vi.fn() }));
vi.mock("../lib/prisma", () => ({ prisma: { whatsAppTemplate: { findUnique: mock.template }, contact: { findMany: mock.contacts }, campaign: { findUnique: mock.campaign }, auditLog: { create: vi.fn() } } }));
vi.mock("../middleware/auth", () => ({ requireAuth: (req: any, _res: any, next: any) => { req.user = { userId: "u1" }; next(); } }));
vi.mock("../services/campaignCostService", () => ({ estimateCampaignCost: mock.estimate, estimateExistingCampaign: mock.existing }));
vi.mock("../services/campaignQueue", () => ({ enqueueCampaign: mock.enqueue }));
import routes from "../routes/campaigns.routes";
import { errorHandler } from "../middleware/errorHandler";
const app = express(); app.use(express.json()); app.use("/campaigns", routes); app.use(errorHandler);
beforeEach(() => { vi.clearAllMocks(); mock.campaign.mockResolvedValue({ id: "c1", name: "test", status: "DRAFT" }); mock.existing.mockResolvedValue({ recipients: 100, rateInr: 0.85, estimatedCost: 85, availableBalance: 20, shortfall: 65, canSend: false }); });
describe("campaign preflight routes", () => {
 it("prevents starting a campaign when wallet credit is insufficient", async () => {
  const res = await request(app).post("/campaigns/c1/start"); expect(res.status).toBe(402); expect(mock.enqueue).not.toHaveBeenCalled();
 });
 it("checks the current category price before enqueueing", async () => {
  mock.existing.mockResolvedValue({ recipients: 10, rateInr: null, canSend: false });
  expect((await request(app).post("/campaigns/c1/start")).status).toBe(400); expect(mock.enqueue).not.toHaveBeenCalled();
 });
 it("allows a sufficiently funded campaign to start", async () => {
  mock.existing.mockResolvedValue({ recipients: 10, rateInr: 0.85, canSend: true });
  expect((await request(app).post("/campaigns/c1/start")).status).toBe(200); expect(mock.enqueue).toHaveBeenCalledWith("c1");
 });
 it("calculates preview from server-side valid recipients", async () => {
  mock.template.mockResolvedValue({ category: "UTILITY", status: "APPROVED" }); mock.contacts.mockResolvedValue([{ phone: "919876543210" }, { phone: "bad" }]); mock.estimate.mockResolvedValue({ recipients: 1 });
  const res = await request(app).post("/campaigns/preview/cost").send({ templateId: "tpl1", audience: { type: "ALL" } });
  expect(res.status).toBe(200); expect(mock.estimate).toHaveBeenCalledWith("UTILITY", 1);
 });
});
