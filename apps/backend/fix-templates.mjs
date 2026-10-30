const WABA_ID = "1398051589192351";
const TOKEN = "EAAOqOxqfapQBS20KRtXzniGB53qMxc9vgCQRI5PzbKDiUjxb1kttUNS4ZANpwwj5VZBoc3ZALHjca2zs5HrHMZClHIZCSfKWCaKd6bxT4ePO5mpFxgHxHp23BvdxqQA5LVBIVkd8CZBp3Eem7FLyoZCUTCZC3L1j9FRIxg5rVJeY6vVqILzCYoXtYepmblZAe9p9FzgZDZD";
const BASE = `https://graph.facebook.com/v20.0`;

// ── Wait 70s for Meta to finish deleting ────────────────────────────────────
console.log("⏳ Waiting 70 seconds for Meta to process deletions...");
await new Promise(r => setTimeout(r, 70000));

// ── Create clean templates ──────────────────────────────────────────────────
console.log("📤 Creating clean templates...");

const TEMPLATES = [
  // ── Customer templates ──────────────────────────────────────────────────
  {
    name: "enquiry_created_customer",
    category: "UTILITY",
    language: "en_US",
    // Removed hardcoded phone numbers — Meta rejects them
    body: "Hi {{1}}, thank you for contacting KSS Interiors. We have received your enquiry for {{2}}. A member of our team will connect with you shortly.\n\nWarm regards,\nTeam KSS Interiors",
  },
  {
    name: "proforma_invoice_created_customer",
    category: "UTILITY",
    language: "en_US",
    body: "Hi {{1}}, the Proforma Invoice for your {{2}} is ready for your review.\n\nFor any clarification, please contact: {{3}}\n\nWarm regards,\nTeam KSS Interiors",
  },
  {
    name: "sales_order_booked_customer",
    category: "UTILITY",
    language: "en_US",
    body: "Hi {{1}}, your order {{2}} has been booked with KSS Interiors. We will keep you informed as your order progresses.\n\nWarm regards,\nTeam KSS Interiors",
  },
  {
    name: "first_service_reminder_customer",
    category: "UTILITY",
    language: "en_US",
    body: "Hi {{1}}, your first service visit for order {{2}} is due within 30 to 45 days of installation. This visit supports the ongoing maintenance of your product. Our team will contact you to schedule it at a time convenient for you.\n\nWarm regards,\nTeam KSS Interiors",
  },
  {
    name: "service_ticket_open_customer",
    category: "UTILITY",
    language: "en_US",
    body: "Hi {{1}}, your service request regarding {{2}} has been registered. Ticket number: {{3}}. Our team will review it and keep you updated.\n\nFor assistance, contact {{4}}.\n\nWarm regards,\nTeam KSS Interiors",
  },
  {
    name: "service_ticket_closed_customer",
    category: "UTILITY",
    language: "en_US",
    // Removed email address to avoid rejection
    body: "Hi {{1}}, your service request {{2}} has been closed in our system. We hope the concern has been addressed.\n\nFor feedback or suggestions, please reach out to our support team.\n\nWarm regards,\nTeam KSS Interiors",
  },
  {
    name: "order_status_production_customer",
    category: "UTILITY",
    language: "en_US",
    body: "Hi {{1}}, your order {{2}} has moved to Production and is now being processed. We will keep you informed as it progresses.\n\nWarm regards,\nTeam KSS Interiors",
  },
  {
    name: "order_status_ready_for_dispatch_customer",
    category: "UTILITY",
    language: "en_US",
    body: "Hi {{1}}, your order {{2}} is ready for dispatch. Our team will coordinate the delivery details with you.\n\nWarm regards,\nTeam KSS Interiors",
  },
  {
    name: "order_status_dispatched_customer",
    category: "UTILITY",
    language: "en_US",
    body: "Hi {{1}}, your order {{2}} was dispatched on {{3}}. Our team will coordinate the next steps with you.\n\nFor assistance, contact {{4}}.\n\nWarm regards,\nTeam KSS Interiors",
  },
  {
    name: "installation_started_customer",
    category: "UTILITY",
    language: "en_US",
    body: "Hi {{1}}, installation for your order {{2}} has started at your site. Our team will keep you updated on the progress.\n\nWarm regards,\nTeam KSS Interiors",
  },
  {
    name: "order_handover_customer",
    category: "UTILITY",
    language: "en_US",
    // URL variables removed from body — using buttons instead
    body: "Hi {{1}}, the handover for your order {{2}} is complete. We appreciate your trust in KSS Interiors.\n\nWe would love your feedback.\n\nWarm regards,\nTeam KSS Interiors",
    buttons: [
      { type: "URL", text: "Google Review", url: "https://g.page/r/kssinteriors/review" },
      { type: "URL", text: "Share Feedback", url: "https://kssinteriors.com/feedback" },
    ],
  },

  // ── Admin / Internal templates ──────────────────────────────────────────
  {
    name: "enquiry_cancelled_or_on_hold_admin",
    category: "UTILITY",
    language: "en_US",
    body: "Enquiry status updated to {{1}}.\n\nEnquiry ID: {{2}}\nCustomer: {{3}}\nRequirement: {{4}}\nReason: {{5}}\n\nPlease review and update the next action.",
  },
  {
    name: "enquiry_followup_delayed_admin",
    category: "UTILITY",
    language: "en_US",
    body: "Follow-up alert: Enquiry {{1}} for {{2}} has had no update for {{3}} days.\n\nLast activity: {{4}}\n\nPlease follow up and update KSSERP.",
  },
  {
    name: "enquiry_converted_to_sales_order_admin",
    category: "UTILITY",
    language: "en_US",
    body: "Enquiry converted to Sales Order.\n\nEnquiry ID: {{1}}\nSales Order: {{2}}\nCustomer: {{3}}\nSalesperson: {{4}}\n\nPlease proceed with the required order handover.",
  },
  {
    name: "prebooked_sales_order_followup_sales",
    category: "UTILITY",
    language: "en_US",
    body: "Follow-up reminder: Pre-booked Sales Order {{1}} for {{2}} is due for follow-up.\n\nCustomer: {{3}}\nLast contacted: {{4}}\nNext action: {{5}}\n\nPlease follow up and update KSSERP.",
  },
];

for (const t of TEMPLATES) {
  const components = [{ type: "BODY", text: t.body }];
  if (t.buttons) {
    components.push({ type: "BUTTONS", buttons: t.buttons });
  }

  const res = await fetch(`${BASE}/${WABA_ID}/message_templates`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: t.name, category: t.category, language: t.language, components }),
  });
  const data = await res.json();
  if (data.id || data.success) {
    console.log(`  ✅ ${t.name} (id: ${data.id})`);
  } else {
    console.log(`  ❌ ${t.name} — ${data.error?.error_user_msg ?? data.error?.message ?? JSON.stringify(data)}`);
  }
}

console.log("\n✅ Done! Meta will review and approve templates shortly.");
