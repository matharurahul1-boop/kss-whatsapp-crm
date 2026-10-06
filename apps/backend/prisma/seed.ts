import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Admin user
  const passwordHash = await bcrypt.hash("Admin@123", 10);
  await prisma.user.upsert({
    where: { email: "admin@kssinteriors.com" },
    update: {},
    create: {
      name: "Karan Singh Sisodia",
      email: "admin@kssinteriors.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  // Real WhatsApp account
  await prisma.whatsAppAccount.deleteMany();
  await prisma.whatsAppAccount.create({
    data: {
      status: "CONNECTED",
      businessName: "KSS Interiors",
      wabaId: "2515898438846296",
      phoneNumberId: "1159341310601864",
      displayPhoneNumber: "+91 98765 43210",
      qualityRating: "GREEN",
      lastConnectedAt: new Date(),
      lastTestedAt: new Date(),
    },
  });

  // Real Meta config
  await prisma.metaConfig.deleteMany();
  await prisma.metaConfig.create({
    data: {
      appId: "",
      wabaId: "2515898438846296",
      phoneNumberId: "1159341310601864",
      webhookVerifyToken: "ashish_whatsapp_bot_2026",
      mode: "live",
    },
  });

  console.log("Seed complete. Run 'Pull from Meta' in the app to import real templates.");
  console.log("Admin login: admin@kssinteriors.com / Admin@123");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
