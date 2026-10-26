import { requireBillingViewer } from "../middleware/requireBillingViewer";
import { getWalletSummary } from "../services/walletSummaryService";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { requireManager } from "../middleware/requireManager";
import { asyncHandler } from "../utils/asyncHandler";
import { getOrCreateWallet } from "../services/walletService";
import { getBillingReport, parseReportFilters } from "../services/billingReportService";
import { exportBillingExcel, exportBillingPdf } from "../services/billingExportService";
const router = Router();
router.use(requireAuth);
router.get("/alerts", requireBillingViewer, asyncHandler(async (_req, res) => {
  const wallet = await getOrCreateWallet();
  res.json({ success: true, data: {
    active: wallet.balance.lt(wallet.lowBalanceThreshold), balance: Number(wallet.balance),
    threshold: Number(wallet.lowBalanceThreshold), walletId: wallet.id,
  } });
}));
router.get("/summary", requireBillingViewer, asyncHandler(async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true, data: await getWalletSummary() });
}));
// Configuration and report access remain Manager-only.
router.use(requireManager);
router.put("/alerts/settings", asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { threshold } = z.object({ threshold: z.number().finite().min(0).max(10000000).multipleOf(0.01) }).parse(req.body);
  const wallet = await getOrCreateWallet();
  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({ where: { id: wallet.id }, data: { lowBalanceThreshold: threshold } });
    await tx.auditLog.create({ data: { userId: req.user!.userId, action: "LOW_BALANCE_THRESHOLD_UPDATED", description: "Low-balance alert threshold set to INR " + threshold } });
  });
  res.json({ success: true, data: { threshold } });
}));
router.get("/reports", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getBillingReport(parseReportFilters(req.query)) });
}));
router.get("/reports/export", asyncHandler(async (req, res) => {
  const format = z.enum(["xlsx", "pdf"]).parse(req.query.format);
  const report = await getBillingReport(parseReportFilters(req.query));
  const buffer = format === "xlsx" ? await exportBillingExcel(report) : await exportBillingPdf(report);
  res.setHeader("Content-Type", format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="billing-' + report.dateFrom + '-to-' + report.dateTo + '.' + format + '"');
  res.setHeader("Cache-Control", "no-store");
  res.send(buffer);
}));
export default router;
