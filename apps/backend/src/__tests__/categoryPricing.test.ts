import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() }, messageRate: { upsert: vi.fn() }, auditLog: { create: vi.fn() }, $transaction: vi.fn() }));
const getCategoryRates = vi.hoisted(() => vi.fn());
vi.mock("../lib/prisma", () => ({ prisma: db }));
vi.mock("../middleware/auth", () => ({ requireAuth: (req: any, _res: any, next: any) => { req.user = { userId: "manager" }; next(); } }));
vi.mock("../services/walletService", () => ({ getCategoryRates, getOrCreateWallet: vi.fn(), topUpWallet: vi.fn() }));
import routes from "../routes/wallet.routes";
import { errorHandler } from "../middleware/errorHandler";
const app = express(); app.use(express.json()); app.use("/wallet", routes); app.use(errorHandler);
beforeEach(() => { vi.resetAllMocks(); db.user.findUnique.mockResolvedValue({ role: "MANAGER" }); db.$transaction.mockImplementation((fn) => fn(db)); getCategoryRates.mockResolvedValue([{ category: "UTILITY", rateInr: "0.4" }]); });
describe("category pricing", () => {
 it("returns numeric category prices", async () => {
  const res = await request(app).get("/wallet/rates"); expect(res.status).toBe(200); expect(res.body.data[0].rateInr).toBe(0.4);
 });
 it("allows managers to set category prices atomically with an audit trail", async () => {
  const res = await request(app).put("/wallet/rates").send([{ category: "UTILITY", rateInr: 0.3 }]);
  expect(res.status).toBe(200); expect(db.messageRate.upsert).toHaveBeenCalledTimes(2);
  expect(db.messageRate.upsert).toHaveBeenCalledWith({ where: { category_hasMedia: { category: "UTILITY", hasMedia: false } }, update: { rateInr: 0.3 }, create: { category: "UTILITY", rateInr: 0.3, hasMedia: false } });
  expect(db.auditLog.create.mock.calls[0][0].data.action).toBe("CATEGORY_RATES_UPDATED");
 });
 it("blocks agents from editing rates", async () => {
  db.user.findUnique.mockResolvedValue({ role: "AGENT" });
  expect((await request(app).put("/wallet/rates").send([{ category: "UTILITY", rateInr: 0.3 }])).status).toBe(403);
  expect(db.messageRate.upsert).not.toHaveBeenCalled();
 });
 it.each([-1, 0.12345, 100001, null, "0.85"])("rejects invalid category price %s", async (rateInr) => {
  expect((await request(app).put("/wallet/rates").send([{ category: "UTILITY", rateInr }])).status).toBe(400);
  expect(db.messageRate.upsert).not.toHaveBeenCalled();
 });
 it("rejects duplicate categories", async () => {
  expect((await request(app).put("/wallet/rates").send([{ category: "UTILITY", rateInr: 0.3 }, { category: "UTILITY", rateInr: 0.5 }])).status).toBe(400);
 });
 it("does not allow media-specific prices", async () => {
  expect((await request(app).put("/wallet/rates").send([{ category: "UTILITY", hasMedia: true, rateInr: 0.3 }])).status).toBe(400);
 });
});
