import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() }, wallet: { update: vi.fn(), findUniqueOrThrow: vi.fn() }, walletTransaction: { groupBy: vi.fn() }, auditLog: { create: vi.fn() }, $transaction: vi.fn(), $queryRaw: vi.fn() }));
const wallet = vi.hoisted(() => vi.fn());
vi.mock("../lib/prisma", () => ({ prisma: db }));
vi.mock("../services/walletService", () => ({ getOrCreateWallet: wallet }));
vi.mock("../middleware/auth", () => ({ requireAuth: (req: any, _res: any, next: any) => { req.user = { userId: "u1", role: "ADMIN" }; next(); } }));
import routes from "../routes/billing.routes";
import { errorHandler } from "../middleware/errorHandler";
const app = express(); app.use(express.json()); app.use("/billing", routes); app.use(errorHandler);
beforeEach(() => { vi.clearAllMocks(); db.user.findUnique.mockResolvedValue({ role: "MANAGER" }); wallet.mockResolvedValue({ id: "default", balance: new Prisma.Decimal("99.99"), lowBalanceThreshold: new Prisma.Decimal(100) }); db.$transaction.mockImplementation((fn) => fn(db)); db.$queryRaw.mockResolvedValue([]); db.wallet.findUniqueOrThrow.mockResolvedValue({ id: "default", currency: "INR", balance: new Prisma.Decimal("99.99") }); db.walletTransaction.groupBy.mockResolvedValue([{ type: "TOPUP", _sum: { amount: new Prisma.Decimal(2000) } }, { type: "DEBIT", _sum: { amount: new Prisma.Decimal("-2000.01") } }, { type: "REFUND", _sum: { amount: new Prisma.Decimal(100) } }]); });
describe("manager billing alerts and reports", () => {
 it("alerts below the configured limit", async () => {
  const res = await request(app).get("/billing/alerts"); expect(res.status).toBe(200); expect(res.body.data).toMatchObject({ active: true, balance: 99.99, threshold: 100 });
 });
 it("clears the alert when balance recovers to the threshold", async () => {
  wallet.mockResolvedValue({ id: "default", balance: new Prisma.Decimal(100), lowBalanceThreshold: new Prisma.Decimal(100) });
  expect((await request(app).get("/billing/alerts")).body.data.active).toBe(false);
 });
 it("disables low-balance alerts at a zero threshold", async () => {
  wallet.mockResolvedValue({ id: "default", balance: new Prisma.Decimal(0), lowBalanceThreshold: new Prisma.Decimal(0) });
  expect((await request(app).get("/billing/alerts")).body.data.active).toBe(false);
 });
 it("saves the threshold with an audit trail", async () => {
  expect((await request(app).put("/billing/alerts/settings").send({ threshold: 250 })).status).toBe(200);
  expect(db.wallet.update).toHaveBeenCalledWith({ where: { id: "default" }, data: { lowBalanceThreshold: 250 } }); expect(db.auditLog.create).toHaveBeenCalled();
 });
 it.each([-1, 0.001, 10000001])("rejects invalid threshold %s", async (threshold) => {
  expect((await request(app).put("/billing/alerts/settings").send({ threshold })).status).toBe(400); expect(db.wallet.update).not.toHaveBeenCalled();
 });
 it.each(["ADMIN", "AGENT"])("denies %s settings and report exports", async (role) => {
  db.user.findUnique.mockResolvedValue({ role });
  for (const path of ["/reports", "/reports/export?format=pdf"]) expect((await request(app).get("/billing" + path)).status).toBe(403);
  expect((await request(app).put("/billing/alerts/settings").send({ threshold: 250 })).status).toBe(403);
 });
 it.each(["ADMIN", "MANAGER"])("allows %s to receive alerts and see refunded lifetime usage", async (role) => {
  db.user.findUnique.mockResolvedValue({ role });
  expect((await request(app).get("/billing/alerts")).body.data.active).toBe(true);
  const summary = await request(app).get("/billing/summary");
  expect(summary.status).toBe(200);
  expect(summary.body.data).toMatchObject({ totalTopUps: 2000, grossUsage: 2000.01, totalRefunds: 100, totalUsed: 1900.01, balance: 99.99 });
  expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
 });
 it("denies Agent wallet alerts and navbar totals", async () => {
  db.user.findUnique.mockResolvedValue({ role: "AGENT" });
  expect((await request(app).get("/billing/alerts")).status).toBe(403);
  expect((await request(app).get("/billing/summary")).status).toBe(403);
 });
 it("rejects stale roles for deleted accounts", async () => {
  db.user.findUnique.mockResolvedValue(null);
  expect((await request(app).get("/billing/summary")).status).toBe(403);
 });
 it("serves report JSON and rejects invalid ranges", async () => {
  expect((await request(app).get("/billing/reports?dateFrom=2026-10-01&dateTo=2026-10-20")).body.data.summary.netSpending).toBe(0);
  expect((await request(app).get("/billing/reports?dateFrom=2026-10-21&dateTo=2026-10-20")).status).toBe(400);
 });
 it("serves actual Excel and PDF download responses", async () => {
  const excel = await request(app).get("/billing/reports/export?format=xlsx");
  expect(excel.status).toBe(200); expect(excel.headers["content-type"]).toContain("spreadsheetml.sheet"); expect(excel.headers["content-disposition"]).toContain(".xlsx");
  const pdf = await request(app).get("/billing/reports/export?format=pdf");
  expect(pdf.status).toBe(200); expect(pdf.headers["content-type"]).toContain("application/pdf");
 });
});
