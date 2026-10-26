import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const db = vi.hoisted(() => ({
  wallet: { upsert: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  messageRate: { createMany: vi.fn(), findUnique: vi.fn() },
  whatsAppTemplate: { findUnique: vi.fn() },
  walletTransaction: { create: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("../lib/prisma", () => ({ prisma: db }));
import { reserveTemplateCost, refundTemplateCost, topUpWallet } from "../services/walletService";
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((fn) => fn(db));
  db.wallet.upsert.mockResolvedValue({ id: "default", balance: new Prisma.Decimal(2000) });
  db.whatsAppTemplate.findUnique.mockResolvedValue({ name: "offer", category: "MARKETING", headerType: "IMAGE", rateInr: new Prisma.Decimal("0.85") });
  db.messageRate.findUnique.mockResolvedValue({ rateInr: new Prisma.Decimal("0.85") });
  db.wallet.updateMany.mockResolvedValue({ count: 1 });
  db.wallet.findUniqueOrThrow.mockResolvedValue({ id: "default", balance: new Prisma.Decimal("1999.15") });
});
describe("wallet billing", () => {
  it("uses the category price and reserves only when sufficient funds remain", async () => {
    await reserveTemplateCost("offer", "919999999999");
    expect(db.messageRate.findUnique).toHaveBeenCalledWith({ where: { category_hasMedia: { category: "MARKETING", hasMedia: false } } });
    expect(db.wallet.updateMany).toHaveBeenCalledWith({ where: { id: "default", balance: { gte: new Prisma.Decimal("0.85") } }, data: { balance: { decrement: new Prisma.Decimal("0.85") } } });
    expect(db.walletTransaction.create.mock.calls[0][0].data.amount.toString()).toBe("-0.85");
    expect(db.walletTransaction.create.mock.calls[0][0].data.balanceAfter.toString()).toBe("1999.15");
  });
  it("blocks sends when the atomic balance check fails", async () => {
    db.wallet.updateMany.mockResolvedValue({ count: 0 });
    await expect(reserveTemplateCost("offer", "919999999999")).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE", status: 402 });
    expect(db.walletTransaction.create).not.toHaveBeenCalled();
  });
  it("does not guess a category for unknown templates", async () => {
    db.whatsAppTemplate.findUnique.mockResolvedValue(null);
    await expect(reserveTemplateCost("unknown", "919999999999")).rejects.toMatchObject({ code: "BILLING_TEMPLATE_MISSING" });
  });
  it("blocks a category without a configured price", async () => {
    db.messageRate.findUnique.mockResolvedValue(null);
    await expect(reserveTemplateCost("offer", "919999999999")).rejects.toMatchObject({ code: "RATE_MISSING" });
    expect(db.wallet.updateMany).not.toHaveBeenCalled();
  });
  it("honors an explicitly free category", async () => {
    db.messageRate.findUnique.mockResolvedValue({ rateInr: new Prisma.Decimal(0) });
    await reserveTemplateCost("free", "919999999999");
    expect(db.walletTransaction.create.mock.calls[0][0].data.amount.toString()).toBe("0");
  });
  it("ignores a template override and charges the category price", async () => {
    db.whatsAppTemplate.findUnique.mockResolvedValue({ name: "premium", category: "MARKETING", headerType: "IMAGE", rateInr: new Prisma.Decimal("1.25") });
    await reserveTemplateCost("premium", "919999999999");
    expect(db.wallet.updateMany.mock.calls[0][0].data.balance.decrement.toString()).toBe("0.85");
    expect(db.walletTransaction.create.mock.calls[0][0].data.amount.toString()).toBe("-0.85");
  });
  it.each(["IMAGE", "NONE", "VIDEO", "TEXT"])("uses the same category price for header %s", async (headerType) => {
    db.whatsAppTemplate.findUnique.mockResolvedValue({ name: "offer", category: "UTILITY", headerType });
    await reserveTemplateCost("offer", "919999999999");
    expect(db.messageRate.findUnique).toHaveBeenCalledWith({ where: { category_hasMedia: { category: "UTILITY", hasMedia: false } } });
    expect(db.walletTransaction.create.mock.calls[0][0].data.amount.toString()).toBe("-0.85");
  });
  it("does not refund a debit twice", async () => {
    db.walletTransaction.updateMany.mockResolvedValue({ count: 0 });
    await refundTemplateCost("debit-1");
    expect(db.wallet.update).not.toHaveBeenCalled();
  });
  it("refunds the original debit rather than the current rate", async () => {
    db.walletTransaction.updateMany.mockResolvedValue({ count: 1 });
    db.walletTransaction.findUniqueOrThrow.mockResolvedValue({ walletId: "default", amount: new Prisma.Decimal("-0.85"), description: "offer" });
    db.wallet.update.mockResolvedValue({ id: "default", balance: new Prisma.Decimal(2000) });
    await refundTemplateCost("debit-1");
    expect(db.wallet.update.mock.calls[0][0].data.balance.increment.toString()).toBe("0.85");
    expect(db.walletTransaction.create.mock.calls[0][0].data.type).toBe("REFUND");
  });
  it.each([0, -1, NaN, Infinity, 1.001, 100001])("rejects invalid top-up %s", async (amount) => {
    await expect(topUpWallet(amount, "manager")).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    expect(db.wallet.update).not.toHaveBeenCalled();
  });
});
