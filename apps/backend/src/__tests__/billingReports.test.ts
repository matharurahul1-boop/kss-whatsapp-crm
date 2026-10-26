import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const db = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock("../lib/prisma", () => ({ prisma: db }));
vi.mock("../services/walletService", () => ({ getOrCreateWallet: vi.fn(async () => ({ id: "default" })) }));
import { getBillingReport, parseReportFilters } from "../services/billingReportService";
beforeEach(() => vi.clearAllMocks());
describe("billing report filters", () => {
 it("uses inclusive India dates and an exclusive next-day boundary", () => {
  const filters = parseReportFilters({ dateFrom: "2026-10-01", dateTo: "2026-10-20", category: "UTILITY" });
  expect(filters.start.toISOString()).toBe("2026-09-30T18:30:00.000Z");
  expect(filters.end.toISOString()).toBe("2026-10-20T18:30:00.000Z");
 });
 it.each([
  { dateFrom: "2026-02-30", dateTo: "2026-03-01" },
  { dateFrom: "2026-10-21", dateTo: "2026-10-20" },
  { dateFrom: "2024-01-01", dateTo: "2026-10-20" },
  { category: "SQL injection" },
 ])("rejects invalid filters %j", (filters) => expect(() => parseReportFilters(filters)).toThrow());
});
describe("billing report totals", () => {
 it("keeps refunds on posting dates, separates top-ups and sums money precisely", async () => {
  db.$queryRaw.mockResolvedValue([
   { date: "2026-10-19", category: "MARKETING", messages: 3, chargedAttempts: 4, spending: new Prisma.Decimal("3.4"), refunds: new Prisma.Decimal("0.85"), topUps: new Prisma.Decimal(0) },
   { date: "2026-10-20", category: "MARKETING", messages: 0, chargedAttempts: 0, spending: new Prisma.Decimal(0), refunds: new Prisma.Decimal("0.85"), topUps: new Prisma.Decimal(0) },
   { date: "2026-10-20", category: "TOPUP", messages: 0, chargedAttempts: 0, spending: new Prisma.Decimal(0), refunds: new Prisma.Decimal(0), topUps: new Prisma.Decimal(2000) },
  ]);
  const report = await getBillingReport(parseReportFilters({ dateFrom: "2026-10-01", dateTo: "2026-10-20" }));
  expect(report.summary).toEqual({ messages: 3, chargedAttempts: 4, spending: 3.4, refunds: 1.7, netSpending: 1.7, topUps: 2000 });
  expect(report.rows[1].netSpending).toBe(-0.85);
 });
 it("binds category and date filters rather than interpolating SQL", async () => {
  db.$queryRaw.mockResolvedValue([]);
  await getBillingReport(parseReportFilters({ dateFrom: "2026-10-01", dateTo: "2026-10-20", category: "UTILITY" }));
  const sql = db.$queryRaw.mock.calls[0][0];
  expect(sql.values).toContain("UTILITY"); expect(sql.values).toContain("default");
  expect(sql.text).not.toContain("'UTILITY'");
 });
 it("returns zero totals for an empty period", async () => {
  db.$queryRaw.mockResolvedValue([]);
  const report = await getBillingReport(parseReportFilters({}));
  expect(report.summary.netSpending).toBe(0); expect(report.rows).toEqual([]);
 });
});
