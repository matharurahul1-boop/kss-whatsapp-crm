import { prisma } from "../lib/prisma";

const DEFAULT_RATES = [
  { category: "MARKETING",      hasMedia: false, rateInr: 0.85 },
  { category: "MARKETING",      hasMedia: true,  rateInr: 0.95 },
  { category: "UTILITY",        hasMedia: false, rateInr: 0.40 },
  { category: "UTILITY",        hasMedia: true,  rateInr: 0.50 },
  { category: "AUTHENTICATION", hasMedia: false, rateInr: 0.15 },
  { category: "AUTHENTICATION", hasMedia: true,  rateInr: 0.15 },
] as const;

export async function getOrCreateWallet() {
  let wallet = await (prisma as any).wallet.findFirst();
  if (!wallet) {
    wallet = await (prisma as any).wallet.create({ data: {} });
    for (const r of DEFAULT_RATES) {
      await (prisma as any).messageRate.upsert({
        where: { category_hasMedia: { category: r.category, hasMedia: r.hasMedia } },
        update: {},
        create: r,
      });
    }
  }
  return wallet;
}

export async function getRateForTemplate(category: string, hasMedia: boolean): Promise<number> {
  const rate = await (prisma as any).messageRate.findUnique({
    where: { category_hasMedia: { category, hasMedia } },
  });
  return rate?.rateInr ?? 0.85;
}

export async function deductWalletCost(opts: {
  category?: string;
  hasMedia?: boolean;
  templateName?: string;
  notificationId: string;
  description: string;
}): Promise<void> {
  try {
    let category = opts.category ?? "MARKETING";
    let hasMedia = opts.hasMedia ?? false;
    if (opts.templateName && !opts.category) {
      const tmpl = await prisma.whatsAppTemplate.findFirst({ where: { name: opts.templateName } });
      if (tmpl) { category = tmpl.category; hasMedia = tmpl.headerType !== "NONE" && tmpl.headerType !== "TEXT"; }
    }
    const cost = await getRateForTemplate(category, hasMedia);
    const wallet = await getOrCreateWallet();
    if (wallet.balance < cost) return;

    const newBalance = parseFloat((wallet.balance - cost).toFixed(4));
    await (prisma as any).wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });
    await (prisma as any).walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "DEBIT",
        amount: -cost,
        balanceAfter: newBalance,
        description: opts.description,
        notificationId: opts.notificationId,
      },
    });
  } catch (err) {
    console.error("[wallet] deduct error:", err);
  }
}

export async function topUpWallet(amount: number, createdById: string, note?: string) {
  const wallet = await getOrCreateWallet();
  const newBalance = parseFloat((wallet.balance + amount).toFixed(4));

  await (prisma as any).wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });

  const tx = await (prisma as any).walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "TOPUP",
      amount,
      balanceAfter: newBalance,
      description: note || `Top-up of ₹${amount}`,
      createdById,
    },
  });

  return { wallet: { ...wallet, balance: newBalance }, transaction: tx };
}
