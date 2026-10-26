import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { exportBillingExcel, exportBillingPdf } from "../services/billingExportService";
import type { BillingReport } from "../services/billingReportService";
const report: BillingReport = { dateFrom: "2026-10-01", dateTo: "2026-10-20", category: "ALL", timezone: "Asia/Kolkata", rows: [
 { date: "2026-10-20", category: "MARKETING", messages: 2, chargedAttempts: 3, spending: 2.55, refunds: 0.85, netSpending: 1.7, topUps: 0 },
], summary: { messages: 2, chargedAttempts: 3, spending: 2.55, refunds: 0.85, netSpending: 1.7, topUps: 0 } };
describe("billing export files", () => {
 it("writes a valid Excel workbook with numeric amounts and totals", async () => {
  const buffer = await exportBillingExcel(report); const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.getWorksheet("Daily billing")!;
  expect(sheet.getCell("E2").value).toBe(2.55); expect(sheet.getCell("F2").value).toBe(0.85); expect(sheet.getCell("G3").value).toBe(1.7);
  expect(workbook.getWorksheet("Summary")!.getCell("B2").value).toBe("2026-10-01 to 2026-10-20");
 });
 it("writes PDF files including empty and multi-page reports", async () => {
  for (const rows of [[], report.rows, Array.from({ length: 75 }, () => report.rows[0])]) {
   const pdf = await exportBillingPdf({ ...report, rows });
   expect(pdf.subarray(0, 5).toString()).toBe("%PDF-"); expect(pdf.length).toBeGreaterThan(1000);
   expect(pdf.toString("latin1")).toContain("%%EOF");
  }
 });
});
