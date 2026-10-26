import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), topup: vi.fn(), wallet: vi.fn(), rates: vi.fn(), transactions: vi.fn(), count: vi.fn() }));
vi.mock("../lib/prisma", () => ({ prisma: { user: { findUnique: mocks.user }, walletTransaction: { findMany: mocks.transactions, count: mocks.count } } }));
vi.mock("../middleware/auth", () => ({ requireAuth: (req: any, _res: any, next: any) => { req.user = { userId: "u1", role: "ADMIN" }; next(); } }));
vi.mock("../services/walletService", () => ({ getOrCreateWallet: mocks.wallet, getCategoryRates: mocks.rates, topUpWallet: mocks.topup }));
import walletRoutes from "../routes/wallet.routes";
import { errorHandler } from "../middleware/errorHandler";
const app = express(); app.use(express.json()); app.use("/wallet", walletRoutes); app.use(errorHandler);
beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue({ id: "u1", role: "AGENT" }); mocks.wallet.mockResolvedValue({ id: "default", balance: 2000 }); mocks.rates.mockResolvedValue([]); mocks.transactions.mockResolvedValue([]); mocks.count.mockResolvedValue(0); });
describe("wallet permissions use current database role", () => {
 it("blocks agent top-ups even with a stale admin claim", async () => {
   expect((await request(app).post("/wallet/topup").send({ amount: 2000 })).status).toBe(403);
   expect(mocks.topup).not.toHaveBeenCalled();
 });
 it("blocks agent rate changes", async () => {
   expect((await request(app).put("/wallet/rates").send([])).status).toBe(403);
 });
 it.each(["ADMIN", "AGENT"])("blocks %s wallet details, transactions and financial changes", async (role) => {
   mocks.user.mockResolvedValue({ id: "u1", role });
   for (const path of ["/wallet", "/wallet/transactions", "/wallet/rates"]) expect((await request(app).get(path)).status).toBe(403);
   expect((await request(app).post("/wallet/topup").send({ amount: 2000 })).status).toBe(403);
   expect((await request(app).put("/wallet/rates").send([])).status).toBe(403);
   expect(mocks.wallet).not.toHaveBeenCalled(); expect(mocks.topup).not.toHaveBeenCalled();
 });
 it("allows Manager wallet details, transactions and category prices", async () => {
   mocks.user.mockResolvedValue({ id: "u1", role: "MANAGER" });
   for (const path of ["/wallet", "/wallet/transactions", "/wallet/rates"]) expect((await request(app).get(path)).status).toBe(200);
 });
 it("allows managers to record top-ups", async () => {
   mocks.user.mockResolvedValue({ id: "u1", role: "MANAGER" });
   mocks.topup.mockResolvedValue({ wallet: { balance: 2000 } });
   const res = await request(app).post("/wallet/topup").send({ amount: 2000, note: "Received payment" });
   expect(res.status).toBe(200);
   expect(mocks.topup).toHaveBeenCalledWith(2000, "u1", "Received payment");
 });
 it("blocks managers from changing user roles", async () => {
   mocks.user.mockResolvedValue({ id: "u1", role: "MANAGER" });
   expect((await request(app).put("/wallet/users/u2/role").send({ role: "ADMIN" })).status).toBe(403);
 });
});
