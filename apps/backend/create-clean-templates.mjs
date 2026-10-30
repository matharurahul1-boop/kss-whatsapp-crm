/**
 * KSS Interiors — WhatsApp Templates (Meta-compliant)
 *
 * Meta approval rules followed:
 * 1. Templates never START with a variable (causes INVALID_FORMAT)
 * 2. Variables are always consecutive: {{1}}, {{2}}, {{3}}... no skipping
 * 3. No hardcoded phone numbers in body (spam flag)
 * 4. No URLs in body — only in BUTTONS component
 * 5. No email addresses hardcoded — use variable {{N}}
 * 6. Max 2 consecutive blank lines
 * 7. Template name: lowercase + underscores only
 * 8. UTILITY category: content must be clearly transactional, no promo language
 * 9. Body under 1024 characters
 * 10. Button URLs must be static (no variable URLs in buttons unless using url_type=DYNAMIC)
 */

const WABA_ID = "1398051589192351";
const TOKEN = "EAAOqOxqfapQBS20KRtXzniGB53qMxc9vgCQRI5PzbKDiUjxb1kttUNS4ZANpwwj5VZBoc3ZALHjca2zs5HrHMZClHIZCSfKWCaKd6bxT4ePO5mpFxgHxHp23BvdxqQA5LVBIVkd8CZBp3Eem7FLyoZCUTCZC3L1j9FRIxg5rVJeY6vVqILzCYoXtYepmblZAe9p9FzgZDZD";
const BASE = "https://graph.facebook.com/v20.0";

// ─────────────────────────────────────────────────────────────────
// TEMPLATE DEFINITIONS
// Variable mapping (for backend reference):
//   enquiry_created_customer:
//     {{1}} customer name  {{2}} product/requirement
//     {{3}}–{{7}} = 5 contact lines from settings (name: number format)
//
//   service_ticket_closed_customer:
//     {{1}} customer name  {{2}} ticket number  {{3}} support email (settings)
//
//   order_handover_customer:
//     {{1}} customer name  {{2}} order number
//     buttons → Google Review + Feedback Form (static URLs, editable in code)
// ─────────────────────────────────────────────────────────────────

const TEMPLATES = [

  // ── CUSTOMER NOTIFICATIONS ────────────────────────────────────

  {
    name: "enquiry_created_customer",
    // 7 variables: {{1}} name, {{2}} product, {{3}}–{{7}} contact lines
    // Each contact line = "Name: Number" from settings, one per variable
    body: [
      "Dear {{1}}, thank you for reaching out to KSS Interiors.",
      "",
      "We have received your enquiry for {{2}} and a member of our team will contact you shortly.",
      "",
      "For immediate assistance, you may contact our team:",
      "{{3}}",
      "{{4}}",
      "{{5}}",
      "{{6}}",
      "{{7}}",
      "",
      "Warm regards,",
      "Team KSS Interiors",
    ].join("\n"),
  },

  {
    name: "proforma_invoice_created_customer",
    // {{1}} name, {{2}} project/order ref, {{3}} contact person + number (from settings)
    body: [
      "Dear {{1}}, your Proforma Invoice for {{2}} is ready for review.",
      "",
      "Please go through it at your earliest convenience. For any clarification, contact: {{3}}",
      "",
      "Warm regards,",
      "Team KSS Interiors",
    ].join("\n"),
  },

  {
    name: "sales_order_booked_customer",
    // {{1}} name, {{2}} sales order number
    body: [
      "Dear {{1}}, your order {{2}} has been confirmed with KSS Interiors.",
      "",
      "We will keep you informed at every stage of your order.",
      "",
      "Warm regards,",
      "Team KSS Interiors",
    ].join("\n"),
  },

  {
    name: "first_service_reminder_customer",
    // {{1}} name, {{2}} sales order number
    body: [
      "Dear {{1}}, your first service visit for order {{2}} is due within 30 to 45 days of installation.",
      "",
      "This complimentary visit ensures your product continues to perform at its best. Our team will reach out to schedule it at a convenient time.",
      "",
      "Warm regards,",
      "Team KSS Interiors",
    ].join("\n"),
  },

  {
    name: "service_ticket_open_customer",
    // {{1}} name, {{2}} concern description, {{3}} ticket number, {{4}} contact number (settings)
    body: [
      "Dear {{1}}, your service request regarding {{2}} has been registered with us.",
      "",
      "Ticket number: {{3}}",
      "",
      "Our team will review your request and keep you updated. For assistance, you may contact {{4}}.",
      "",
      "Warm regards,",
      "Team KSS Interiors",
    ].join("\n"),
  },

  {
    name: "service_ticket_closed_customer",
    // {{1}} name, {{2}} ticket number, {{3}} support email (from settings)
    body: [
      "Dear {{1}}, your service request {{2}} has been resolved and closed in our system.",
      "",
      "We hope the concern has been addressed to your satisfaction. For feedback, you may write to us at {{3}}.",
      "",
      "Warm regards,",
      "Team KSS Interiors",
    ].join("\n"),
  },

  {
    name: "order_status_production_customer",
    // {{1}} name, {{2}} order number
    body: [
      "Dear {{1}}, your order {{2}} has entered the Production stage and is now being processed.",
      "",
      "We will notify you as it progresses to the next stage.",
      "",
      "Warm regards,",
      "Team KSS Interiors",
    ].join("\n"),
  },

  {
    name: "order_status_ready_for_dispatch_customer",
    // {{1}} name, {{2}} order number
    body: [
      "Dear {{1}}, your order {{2}} is ready for dispatch.",
      "",
      "Our team will coordinate the delivery details with you shortly.",
      "",
      "Warm regards,",
      "Team KSS Interiors",
    ].join("\n"),
  },

  {
    name: "order_status_dispatched_customer",
    // {{1}} name, {{2}} order number, {{3}} dispatch date, {{4}} contact number (settings)
    body: [
      "Dear {{1}}, your order {{2}} has been dispatched on {{3}}.",
      "",
      "Our team will coordinate the next steps with you. For assistance, contact {{4}}.",
      "",
      "Warm regards,",
      "Team KSS Interiors",
    ].join("\n"),
  },

  {
    name: "installation_started_customer",
    // {{1}} name, {{2}} order number
    body: [
      "Dear {{1}}, installation for your order {{2}} has commenced at your site.",
      "",
      "Our team is on-site and will keep you updated on the progress.",
      "",
      "Warm regards,",
      "Team KSS Interiors",
    ].join("\n"),
  },

  {
    name: "order_handover_customer",
    // {{1}} name, {{2}} order number
    // URLs via buttons — body has NO URLs (Meta rejects variable/inline URLs in body)
    body: [
      "Dear {{1}}, the handover for your order {{2}} has been completed successfully.",
      "",
      "We appreciate your trust in KSS Interiors. We would love to hear about your experience.",
      "",
      "Warm regards,",
      "Team KSS Interiors",
    ].join("\n"),
    buttons: [
      { type: "URL", text: "Share Google Review", url: "https://g.page/r/kssinteriors/review" },
      { type: "URL", text: "Submit Feedback", url: "https://kssinteriors.com/feedback" },
    ],
  },

  // ── ADMIN / INTERNAL NOTIFICATIONS ───────────────────────────

  {
    name: "enquiry_cancelled_or_on_hold_admin",
    // {{1}} status (Cancelled/On Hold), {{2}} enquiry ID, {{3}} customer name,
    // {{4}} requirement, {{5}} reason/remarks
    body: [
      "Enquiry status has been updated to {{1}}.",
      "",
      "Enquiry ID: {{2}}",
      "Customer: {{3}}",
      "Requirement: {{4}}",
      "Reason: {{5}}",
      "",
      "Please review and update the next action in the system.",
    ].join("\n"),
  },

  {
    name: "enquiry_followup_delayed_admin",
    // {{1}} enquiry ID, {{2}} customer name, {{3}} number of days, {{4}} last activity
    body: [
      "Follow-up alert for Enquiry {{1}}.",
      "",
      "Customer: {{2}}",
      "No update recorded for: {{3}} days",
      "Last activity: {{4}}",
      "",
      "Please follow up with the customer and update the system.",
    ].join("\n"),
  },

  {
    name: "enquiry_converted_to_sales_order_admin",
    // {{1}} enquiry ID, {{2}} sales order number, {{3}} customer name, {{4}} salesperson
    body: [
      "Enquiry {{1}} has been converted to a Sales Order.",
      "",
      "Sales Order: {{2}}",
      "Customer: {{3}}",
      "Salesperson: {{4}}",
      "",
      "Please proceed with the required order handover process.",
    ].join("\n"),
  },

  {
    name: "prebooked_sales_order_followup_sales",
    // {{1}} order number, {{2}} project ref, {{3}} customer name,
    // {{4}} last contacted date, {{5}} next action
    body: [
      "Follow-up reminder for Pre-booked Sales Order {{1}}.",
      "",
      "Project: {{2}}",
      "Customer: {{3}}",
      "Last contacted: {{4}}",
      "Next action: {{5}}",
      "",
      "Please follow up and update the system.",
    ].join("\n"),
  },
];

// ── Validate before sending ───────────────────────────────────────────────
function validate(t) {
  const issues = [];
  if (t.body.startsWith("{{")) issues.push("Body starts with a variable");
  const vars = [...t.body.matchAll(/\{\{(\d+)\}\}/g)].map(m => +m[1]);
  const unique = [...new Set(vars)].sort((a, b) => a - b);
  for (let i = 0; i < unique.length; i++) {
    if (unique[i] !== i + 1) { issues.push(`Non-consecutive variables — found {{${unique[i]}}} but expected {{${i + 1}}}`); break; }
  }
  if (t.body.length > 1024) issues.push(`Body too long: ${t.body.length} chars (max 1024)`);
  if (/https?:\/\//.test(t.body)) issues.push("URL found in body — move to buttons");
  return issues;
}

console.log("🔍 Validating templates...\n");
let hasError = false;
for (const t of TEMPLATES) {
  const issues = validate(t);
  if (issues.length) {
    console.log(`❌ ${t.name}:`);
    issues.forEach(i => console.log(`   • ${i}`));
    hasError = true;
  }
}
if (hasError) { console.log("\nFix issues above before submitting."); process.exit(1); }
console.log("✅ All templates valid\n");

// ── Submit ────────────────────────────────────────────────────────────────
console.log("📤 Submitting to Meta...\n");
let ok = 0, fail = 0;

for (const t of TEMPLATES) {
  const components = [{ type: "BODY", text: t.body }];
  if (t.buttons) components.push({ type: "BUTTONS", buttons: t.buttons });

  const res = await fetch(`${BASE}/${WABA_ID}/message_templates`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: t.name, category: t.category ?? "UTILITY", language: "en_US", components }),
  });
  const data = await res.json();

  if (data.id) {
    console.log(`  ✅ ${t.name}  [${data.status}]`);
    ok++;
  } else {
    console.log(`  ❌ ${t.name}  — ${data.error?.error_user_msg ?? data.error?.message}`);
    fail++;
  }
}

console.log(`\n${ok} submitted, ${fail} failed.`);
console.log("Meta will review and move to APPROVED status within 24–48 hours.");
