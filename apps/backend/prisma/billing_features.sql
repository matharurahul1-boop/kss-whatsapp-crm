-- Additive setup for configurable in-app alerts and category reporting.
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "lowBalanceThreshold" DECIMAL(14,4) NOT NULL DEFAULT 100;
ALTER TABLE "WalletTransaction" ADD COLUMN IF NOT EXISTS "category" "TemplateCategory";
ALTER TABLE "WalletTransaction" ADD COLUMN IF NOT EXISTS "templateName" TEXT;
CREATE INDEX IF NOT EXISTS "WalletTransaction_walletId_category_createdAt_idx" ON "WalletTransaction"("walletId", "category", "createdAt");
-- Recover known historic categories from the immutable debit/refund descriptions.
UPDATE "WalletTransaction"
SET "category" = substring("description" from '\((MARKETING|UTILITY|AUTHENTICATION),')::"TemplateCategory",
    "templateName" = regexp_replace(split_part("description", ' (', 1), '^Send failed: ', '')
WHERE "category" IS NULL AND "type" IN ('DEBIT', 'REFUND')
  AND "description" ~ '\((MARKETING|UTILITY|AUTHENTICATION),';
