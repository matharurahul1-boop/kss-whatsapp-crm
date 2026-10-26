import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";

async function loadMetaConfigFromDb() {
  try {
    const config = await prisma.metaConfig.findFirst();
    if (!config) return;
    if (config.appId)         { process.env.META_APP_ID = config.appId;                       env.metaAppId = config.appId; }
    if (config.wabaId)        { process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = config.wabaId;     env.wabaId = config.wabaId; }
    if (config.phoneNumberId) { process.env.WHATSAPP_PHONE_NUMBER_ID = config.phoneNumberId;  env.phoneNumberId = config.phoneNumberId; }
    // Note: accessToken and appSecret are stored hashed/masked only — live values come from .env
    console.log("[startup] Meta config loaded from DB (appId, wabaId, phoneNumberId)");
  } catch (e) {
    console.warn("[startup] Could not load Meta config from DB:", e);
  }
}

const app = createApp();

loadMetaConfigFromDb().then(() => {
  app.listen(env.port, () => {
    console.log(`KSS WhatsApp Notifications backend listening on port ${env.port} (mode: ${env.metaMode})`);
  });
});
