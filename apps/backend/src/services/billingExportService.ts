import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { BillingReport, BillingReportRow } from "./billingReportService";

const columns = ["Date (IST)", "Category", "Sent messages", "Charged attempts", "Gross (INR)", "Refunds (INR)", "Net (INR)", "Top-ups (INR)"];
const values = (row: BillingReportRow) => [row.date, row.category, row.messages, row.chargedAttempts, row.spending, row.refunds, row.netSpending, row.topUps];
export async function exportBillingExcel(report: BillingReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KSS WhatsApp";
  const summary = workbook.addWorksheet("Summary");
  summary.columns = [{ width: 30 }, { width: 28 }];
  summary.addRows([
    ["KSS WhatsApp Billing Report"], ["Period (IST)", report.dateFrom + " to " + report.dateTo],
    ["Category", report.category], ["Sent messages", report.summary.messages], ["Charged attempts", report.summary.chargedAttempts],
    ["Gross spending (INR)", report.summary.spending], ["Refunds (INR)", report.summary.refunds],
    ["Net spending (INR)", report.summary.netSpending], ["Top-ups (INR)", report.summary.topUps],
    ["Basis", "Transaction posting date in IST"], ["Sent messages", "Accepted by the WhatsApp provider"],
    ["Note", "Refunds are shown on their posting date."], ["Category filter", "Top-ups included only for ALL categories."],
  ]);
  summary.getRow(1).font = { bold: true, size: 16, color: { argb: "FF0F7A4D" } };
  for (let row = 6; row <= 9; row++) summary.getCell(row, 2).numFmt = '#,##0.0000';
  const sheet = workbook.addWorksheet("Daily billing", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.addRow(columns);
  sheet.columns.forEach((column, i) => { column.width = [17, 23, 17, 19, 21, 21, 21, 21][i]; });
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F7A4D" } };
  report.rows.forEach((row) => sheet.addRow(values(row)));
  sheet.addRow(["TOTAL", "", report.summary.messages, report.summary.chargedAttempts, report.summary.spending, report.summary.refunds, report.summary.netSpending, report.summary.topUps]);
  sheet.lastRow!.font = { bold: true };
  for (let col = 5; col <= 8; col++) sheet.getColumn(col).numFmt = '#,##0.0000';
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, report.rows.length + 1), column: 8 } };
  sheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1" };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function exportBillingPdf(report: BillingReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 32, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
    doc.font("Helvetica-Bold").fontSize(20).fillColor("#0f7a4d").text("KSS WhatsApp | Billing Report");
    doc.font("Helvetica").fontSize(10).fillColor("#333333").text(report.dateFrom + " to " + report.dateTo + " (IST)  |  Category: " + report.category);
    doc.moveDown().fontSize(10).text("Sent: " + report.summary.messages + "   |   Charged attempts: " + report.summary.chargedAttempts + "   |   Gross: INR " + report.summary.spending.toFixed(4));
    doc.text("Refunds: INR " + report.summary.refunds.toFixed(4) + "   |   Net: INR " + report.summary.netSpending.toFixed(4) + "   |   Top-ups: INR " + report.summary.topUps.toFixed(4));
    doc.moveDown(0.6).fontSize(8).text("Transaction posting date in Asia/Kolkata. Sent = provider-accepted messages. Refunds post on their actual date; top-ups appear only for ALL categories.");
    const widths = [76, 123, 70, 76, 105, 105, 105, 105];
    const totalWidth = widths.reduce((a, b) => a + b, 0);
    // A4 landscape available width is 777 points; these widths total 765.
    let y = doc.y + 14;
    const row = (items: (string | number)[], header = false) => {
      doc.rect(32, y - 4, totalWidth, 25).fill(header ? "#0f7a4d" : "#f5f7f6");
      doc.fillColor(header ? "#ffffff" : "#222222").font(header ? "Helvetica-Bold" : "Helvetica").fontSize(8);
      let x = 32;
      items.forEach((item, index) => { doc.text(String(item), x + 5, y + 2, { width: widths[index] - 10, lineBreak: false, align: index > 1 ? "right" : "left" }); x += widths[index]; });
      y += 27;
    };
    const heading = () => row(["Date (IST)", "Category", "Sent", "Attempts", "Gross INR", "Refund INR", "Net INR", "Top-up INR"], true);
    heading();
    if (!report.rows.length) { doc.fillColor("#555555").text("No transactions in this period.", 38, y + 5); y += 27; }
    report.rows.forEach((entry) => {
      if (y > doc.page.height - 75) { doc.addPage(); y = 40; heading(); }
      row([entry.date, entry.category, entry.messages, entry.chargedAttempts, entry.spending.toFixed(4), entry.refunds.toFixed(4), entry.netSpending.toFixed(4), entry.topUps.toFixed(4)]);
    });
    if (y > doc.page.height - 75) { doc.addPage(); y = 40; heading(); }
    row(["TOTAL", "", report.summary.messages, report.summary.chargedAttempts, report.summary.spending.toFixed(4), report.summary.refunds.toFixed(4), report.summary.netSpending.toFixed(4), report.summary.topUps.toFixed(4)], true);
    const pages = doc.bufferedPageRange();
    for (let page = 0; page < pages.count; page++) {
      doc.switchToPage(page); doc.font("Helvetica").fontSize(8).fillColor("#666666");
      doc.text("KSS WhatsApp  |  Page " + (page + 1) + " of " + pages.count, 32, doc.page.height - 26, { lineBreak: false });
    }
    doc.end();
  });
}
