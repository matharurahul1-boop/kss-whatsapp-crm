import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Clearing all data...");

  await prisma.auditLog.deleteMany();
  await prisma.campaignRecipient.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.contactTag.deleteMany();
  await prisma.whatsAppTemplate.deleteMany();
  await prisma.metaConfig.deleteMany();
  await prisma.whatsAppAccount.deleteMany();
  await prisma.apiKey.deleteMany();

  console.log("All data cleared.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
