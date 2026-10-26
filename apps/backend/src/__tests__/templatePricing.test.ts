import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const db = vi.hoisted(() => ({
 user: { findUnique: vi.fn() },
 whatsAppTemplate: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
 auditLog: { create: vi.fn() }, $transaction: vi.fn(),
}));
const fetchTemplates = vi.hoisted(() => vi.fn());
vi.mock("../lib/prisma", () => ({ prisma: db }));
vi.mock("../lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("../middleware/auth", () => ({ requireAuth: (req: any, _res: any, next: any) => { req.user = { userId: "manager" }; next(); } }));
vi.mock("../services/whatsapp", () => ({ getWhatsAppService: () => ({ fetchTemplates }) }));
import templatesRoutes from "../routes/templates.routes";
import { errorHandler } from "../middleware/errorHandler";
const app = express(); app.use(express.json()); app.use("/templates", templatesRoutes); app.use(errorHandler);
beforeEach(() => {
 vi.resetAllMocks(); db.$transaction.mockImplementation((fn) => fn(db));
 db.user.findUnique.mockResolvedValue({ id: "manager", role: "MANAGER" });
 db.whatsAppTemplate.findUnique.mockResolvedValue({ id: "tpl1", name: "offer", status: "APPROVED", rateInr: new Prisma.Decimal("0.85") });
 db.whatsAppTemplate.update.mockResolvedValue({ id: "tpl1", name: "offer", status: "APPROVED", rateInr: new Prisma.Decimal("1.25") });
});
describe("template pricing", () => {
 it("directs old template-price clients to category prices", async () => {
   const res = await request(app).put("/templates/tpl1/rate").send({ rateInr: 1.25 });
   expect(res.status).toBe(410); expect(res.body.error.code).toBe("CATEGORY_PRICING_REQUIRED");
   expect(db.whatsAppTemplate.update).not.toHaveBeenCalled();
 });
 it("pulls provider content without deleting templates or overwriting local prices", async () => {
   fetchTemplates.mockResolvedValue([{ name: "offer", category: "MARKETING", status: "APPROVED", language: "en", body: "Hello", headerType: "NONE", variableCount: 0 }]);
   db.whatsAppTemplate.upsert.mockResolvedValue({ id: "tpl1", rateInr: new Prisma.Decimal("1.25") });
   const res = await request(app).post("/templates/pull").send({});
   expect(res.status).toBe(200); expect(db.whatsAppTemplate.deleteMany).not.toHaveBeenCalled();
   const update = db.whatsAppTemplate.upsert.mock.calls[0][0].update;
   expect(update).not.toHaveProperty("rateInr"); expect(update).not.toHaveProperty("id");
 });
});
