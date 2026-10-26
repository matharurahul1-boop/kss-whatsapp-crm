import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getOrCreateWallet } from "./walletService";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid date");
export function parseReportFilters(query: unknown) {
  const today = new Date(Date.now() + 19800000).toISOString().slice(0, 10);
  const defaultStart = new Date(new Date(today + "T00:00:00Z").getTime() - 29 * 86400000).toISOString().slice(0, 10);
  const parsed = z.object({
    dateFrom: day.default(defaultStart), dateTo: day.default(today),
    category: z.enum(["ALL", "UTILITY", "MARKETING", "AUTHENTICATION", "UNKNOWN"]).default("ALL"),
  }).refine((data) => data.dateFrom <= data.dateTo, "Start date must be before end date")
    .refine((data) => new Date(data.dateTo).getTime() - new Date(data.dateFrom).getTime() < 366 * 86400000, "Choose at most 366 days").parse(query);
  const start = new Date(parsed.dateFrom + "T00:00:00+05:30");
  const end = new Date(new Date(parsed.dateTo + "T00:00:00+05:30").getTime() + 86400000);
  return { ...parsed, start, end };
}
export type ReportFilters = ReturnType<typeof parseReportFilters>;
export interface BillingReportRow {
  date: string; category: string; messages: number; chargedAttempts: number;
  spending: number; refunds: number; netSpending: number; topUps: number;
}
interface RawRow extends Omit<BillingReportRow, "spending" | "refunds" | "netSpending" | "topUps"> {
  spending: Prisma.Decimal; refunds: Prisma.Decimal; topUps: Prisma.Decimal;
}
export async function getBillingReport(filters: ReportFilters) {
  const wallet = await getOrCreateWallet();
  const categoryFilter = filters.category === "ALL" ? Prisma.empty : filters.category === "UNKNOWN"
    ? Prisma.sql`AND "category" IS NULL AND "type" != 'TOPUP'`
    : Prisma.sql`AND "category" = ${filters.category}::"TemplateCategory"`;
  const raw = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS "date",
      CASE WHEN "type" = 'TOPUP' THEN 'TOPUP' ELSE COALESCE("category"::text, 'UNKNOWN') END AS "category",
      (count(*) FILTER (WHERE "type" = 'DEBIT' AND "messageId" IS NOT NULL))::int AS "messages",
      (count(*) FILTER (WHERE "type" = 'DEBIT'))::int AS "chargedAttempts",
      coalesce(sum(-"amount") FILTER (WHERE "type" = 'DEBIT'), 0) AS "spending",
      coalesce(sum("amount") FILTER (WHERE "type" = 'REFUND'), 0) AS "refunds",
      coalesce(sum("amount") FILTER (WHERE "type" = 'TOPUP'), 0) AS "topUps"
    FROM "WalletTransaction"
    WHERE "walletId" = ${wallet.id} AND "createdAt" >= ${filters.start} AND "createdAt" < ${filters.end} ${categoryFilter}
    GROUP BY 1, 2 ORDER BY 1, 2
  `);
  const rows: BillingReportRow[] = raw.map((row) => ({ ...row,
    spending: Number(row.spending), refunds: Number(row.refunds), topUps: Number(row.topUps),
    netSpending: Number(new Prisma.Decimal(row.spending).minus(row.refunds)),
  }));
  const sum = (key: "spending" | "refunds" | "topUps") => raw.reduce((total, row) => total.plus(row[key]), new Prisma.Decimal(0));
  return { dateFrom: filters.dateFrom, dateTo: filters.dateTo, category: filters.category, timezone: "Asia/Kolkata", rows,
    summary: { messages: rows.reduce((total, row) => total + row.messages, 0), chargedAttempts: rows.reduce((total, row) => total + row.chargedAttempts, 0),
      spending: Number(sum("spending")), refunds: Number(sum("refunds")), netSpending: Number(sum("spending").minus(sum("refunds"))), topUps: Number(sum("topUps")) },
  };
}
export type BillingReport = Awaited<ReturnType<typeof getBillingReport>>;
