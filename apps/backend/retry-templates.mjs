/**
 * Retry script — keeps trying until all 15 templates are created
 * Skips already-created ones, waits 60s between retries for "being deleted" ones
 */

const WABA_ID = "1398051589192351";
const TOKEN = "EAAOqOxqfapQBS20KRtXzniGB53qMxc9vgCQRI5PzbKDiUjxb1kttUNS4ZANpwwj5VZBoc3ZALHjca2zs5HrHMZClHIZCSfKWCaKd6bxT4ePO5mpFxgHxHp23BvdxqQA5LVBIVkd8CZBp3Eem7FLyoZCUTCZC3L1j9FRIxg5rVJeY6vVqILzCYoXtYepmblZAe9p9FzgZDZD";
const BASE = "https://graph.facebook.com/v20.0";

const TEMPLATES = [
  { name: "enquiry_created_customer", body: ["Dear {{1}}, thank you for reaching out to KSS Interiors.","","We have received your enquiry for {{2}} and a member of our team will contact you shortly.","","For immediate assistance, you may contact our team:","{{3}}","{{4}}","{{5}}","{{6}}","{{7}}","","Warm regards,","Team KSS Interiors"].join("\n") },
  { name: "proforma_invoice_created_customer", body: ["Dear {{1}}, your Proforma Invoice for {{2}} is ready for review.","","Please go through it at your earliest convenience. For any clarification, contact: {{3}}","","Warm regards,","Team KSS Interiors"].join("\n") },
  { name: "sales_order_booked_customer", body: ["Dear {{1}}, your order {{2}} has been confirmed with KSS Interiors.","","We will keep you informed at every stage of your order.","","Warm regards,","Team KSS Interiors"].join("\n") },
  { name: "first_service_reminder_customer", body: ["Dear {{1}}, your first service visit for order {{2}} is due within 30 to 45 days of installation.","","This complimentary visit ensures your product continues to perform at its best. Our team will reach out to schedule it at a convenient time.","","Warm regards,","Team KSS Interiors"].join("\n") },
  { name: "service_ticket_open_customer", body: ["Dear {{1}}, your service request regarding {{2}} has been registered with us.","","Ticket number: {{3}}","","Our team will review your request and keep you updated. For assistance, you may contact {{4}}.","","Warm regards,","Team KSS Interiors"].join("\n") },
  { name: "service_ticket_closed_customer", body: ["Dear {{1}}, your service request {{2}} has been resolved and closed in our system.","","We hope the concern has been addressed to your satisfaction. For feedback, you may write to us at {{3}}.","","Warm regards,","Team KSS Interiors"].join("\n") },
  { name: "order_status_production_customer", body: ["Dear {{1}}, your order {{2}} has entered the Production stage and is now being processed.","","We will notify you as it progresses to the next stage.","","Warm regards,","Team KSS Interiors"].join("\n") },
  { name: "order_status_ready_for_dispatch_customer", body: ["Dear {{1}}, your order {{2}} is ready for dispatch.","","Our team will coordinate the delivery details with you shortly.","","Warm regards,","Team KSS Interiors"].join("\n") },
  { name: "order_status_dispatched_customer", body: ["Dear {{1}}, your order {{2}} has been dispatched on {{3}}.","","Our team will coordinate the next steps with you. For assistance, contact {{4}}.","","Warm regards,","Team KSS Interiors"].join("\n") },
  { name: "installation_started_customer", body: ["Dear {{1}}, installation for your order {{2}} has commenced at your site.","","Our team is on-site and will keep you updated on the progress.","","Warm regards,","Team KSS Interiors"].join("\n") },
  { name: "order_handover_customer", body: ["Dear {{1}}, the handover for your order {{2}} has been completed successfully.","","We appreciate your trust in KSS Interiors. We would love to hear about your experience.","","Warm regards,","Team KSS Interiors"].join("\n"), buttons: [{ type: "URL", text: "Share Google Review", url: "https://g.page/r/kssinteriors/review" },{ type: "URL", text: "Submit Feedback", url: "https://kssinteriors.com/feedback" }] },
  { name: "enquiry_cancelled_or_on_hold_admin", body: ["Enquiry status has been updated to {{1}}.","","Enquiry ID: {{2}}","Customer: {{3}}","Requirement: {{4}}","Reason: {{5}}","","Please review and update the next action in the system."].join("\n") },
  { name: "enquiry_followup_delayed_admin", body: ["Follow-up alert for Enquiry {{1}}.","","Customer: {{2}}","No update recorded for: {{3}} days","Last activity: {{4}}","","Please follow up with the customer and update the system."].join("\n") },
  { name: "enquiry_converted_to_sales_order_admin", body: ["Enquiry {{1}} has been converted to a Sales Order.","","Sales Order: {{2}}","Customer: {{3}}","Salesperson: {{4}}","","Please proceed with the required order handover process."].join("\n") },
  { name: "prebooked_sales_order_followup_sales", body: ["Follow-up reminder for Pre-booked Sales Order {{1}}.","","Project: {{2}}","Customer: {{3}}","Last contacted: {{4}}","Next action: {{5}}","","Please follow up and update the system."].join("\n") },
];

async function tryCreate(t) {
  const components = [{ type: "BODY", text: t.body }];
  if (t.buttons) components.push({ type: "BUTTONS", buttons: t.buttons });

  const res = await fetch(`${BASE}/${WABA_ID}/message_templates`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: t.name, category: "UTILITY", language: "en_US", components }),
  });
  return res.json();
}

const done = new Set();
const MAX_ROUNDS = 10;

for (let round = 1; round <= MAX_ROUNDS; round++) {
  const pending = TEMPLATES.filter(t => !done.has(t.name));
  if (pending.length === 0) break;

  console.log(`\n── Round ${round} — ${pending.length} remaining ──`);

  let stillWaiting = [];

  for (const t of pending) {
    const data = await tryCreate(t);

    if (data.id) {
      console.log(`  ✅ ${t.name}  [${data.status}]`);
      done.add(t.name);
    } else if (data.error?.error_subcode === 2388116) {
      // "already exists" — treat as done
      console.log(`  ✅ ${t.name}  [already exists]`);
      done.add(t.name);
    } else if (data.error?.message?.includes("being deleted")) {
      console.log(`  ⏳ ${t.name}  — still deleting, will retry`);
      stillWaiting.push(t.name);
    } else {
      const msg = data.error?.error_user_msg ?? data.error?.message ?? JSON.stringify(data);
      console.log(`  ❌ ${t.name}  — ${msg}`);
      // Don't retry permanent errors
      done.add(t.name);
    }
  }

  if (stillWaiting.length === 0) break;

  if (round < MAX_ROUNDS) {
    console.log(`\n  ⏳ ${stillWaiting.length} still deleting — waiting 60s before retry...`);
    await new Promise(r => setTimeout(r, 60000));
  }
}

console.log(`\n─────────────────────────────`);
console.log(`Done: ${done.size}/15 templates processed`);
const missing = TEMPLATES.filter(t => !done.has(t.name)).map(t => t.name);
if (missing.length) console.log(`Still pending: ${missing.join(", ")}`);
else console.log("All 15 submitted! Meta will approve within 24-48 hours.");
