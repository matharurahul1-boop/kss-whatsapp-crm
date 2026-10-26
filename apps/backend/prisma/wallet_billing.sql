-- CreateEnum
CREATE TYPE "WalletTxType" AS ENUM ('TOPUP', 'DEBIT', 'REFUND');

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "balance" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletTxType" NOT NULL,
    "amount" DECIMAL(14,4) NOT NULL,
    "balanceAfter" DECIMAL(14,4) NOT NULL,
    "description" TEXT NOT NULL,
    "messageId" TEXT,
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "notificationId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageRate" (
    "id" TEXT NOT NULL,
    "category" "TemplateCategory" NOT NULL,
    "hasMedia" BOOLEAN NOT NULL DEFAULT false,
    "rateInr" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageRate_category_hasMedia_key" ON "MessageRate"("category", "hasMedia");

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Billing is accessible only through the authenticated backend, never the Data API.
ALTER TABLE "Wallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WalletTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageRate" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "Wallet", "WalletTransaction", "MessageRate" FROM anon, authenticated;
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_nonnegative" CHECK (balance >= 0);
ALTER TABLE "MessageRate" ADD CONSTRAINT "MessageRate_nonnegative" CHECK ("rateInr" >= 0);
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'AGENT';

CREATE INDEX "WalletTransaction_messageId_idx" ON "WalletTransaction"("messageId");
