-- Per-template internal pricing; unset prices must be configured before sending.
ALTER TABLE "WhatsAppTemplate" ADD COLUMN IF NOT EXISTS "rateInr" DECIMAL(14,4);
ALTER TABLE "WhatsAppTemplate" ADD CONSTRAINT "WhatsAppTemplate_rateInr_nonnegative" CHECK ("rateInr" >= 0);
