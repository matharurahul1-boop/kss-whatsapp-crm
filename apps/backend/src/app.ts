import billingRoutes from "./routes/billing.routes";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import path from "path";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { prisma } from "./lib/prisma";
import { resetWhatsAppService } from "./services/whatsapp";

import authRoutes from "./routes/auth.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import whatsappAccountRoutes from "./routes/whatsappAccount.routes";
import settingsRoutes from "./routes/settings.routes";
import templatesRoutes from "./routes/templates.routes";
import contactsRoutes from "./routes/contacts.routes";
import campaignsRoutes from "./routes/campaigns.routes";
import notificationsRoutes from "./routes/notifications.routes";
import apiKeysRoutes from "./routes/apiKeys.routes";
import webhooksRoutes from "./routes/webhooks.routes";
import conversationsRoutes from "./routes/conversations.routes";
import uploadRoutes from "./routes/upload.routes";
import v1Routes from "./routes/v1";
import triggersRoutes from "./routes/triggers.routes";
import walletRoutes from "./routes/wallet.routes";

// Load Meta config from DB once per process (warm Vercel instances reuse it)
let configLoaded = false;
async function ensureMetaConfig() {
  if (configLoaded) return;
  try {
    // Select only columns that always exist (avoids crash if migration not run yet)
    const config = await prisma.metaConfig.findFirst({
      select: { appId: true, wabaId: true, phoneNumberId: true },
    });
    if (!config) return;
    if (config.appId)         { process.env.META_APP_ID = config.appId;                       env.metaAppId = config.appId; }
    if (config.wabaId)        { process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = config.wabaId;     env.wabaId = config.wabaId; }
    if (config.phoneNumberId) { process.env.WHATSAPP_PHONE_NUMBER_ID = config.phoneNumberId;  env.phoneNumberId = config.phoneNumberId; }

    // Try to load plain-text tokens (only available after SQL migration is run)
    try {
      const sensitive = await prisma.$queryRaw<{ accessTokenPlain: string | null; appSecretPlain: string | null }[]>`
        SELECT "accessTokenPlain", "appSecretPlain" FROM "MetaConfig" LIMIT 1
      `;
      const s = sensitive[0];
      if (s?.accessTokenPlain) { process.env.WHATSAPP_ACCESS_TOKEN = s.accessTokenPlain; env.accessToken = s.accessTokenPlain; }
      if (s?.appSecretPlain)   { process.env.META_APP_SECRET = s.appSecretPlain;          env.metaAppSecret = s.appSecretPlain; }
    } catch {
      // Columns don't exist yet — tokens stay as Vercel env vars until migration runs
    }

    resetWhatsAppService();
    configLoaded = true;
  } catch (e) {
    console.warn("[app] Could not load Meta config from DB:", e);
  }
}

export function createApp() {
  const app = express();

  // Run DB config load on every cold start (Vercel serverless)
  app.use((_req, _res, next) => { ensureMetaConfig().then(next).catch(next); });

  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: "15mb" }));
  // Serve uploaded media files publicly
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  app.use(cookieParser());
  if (env.nodeEnv !== "test") {
    app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
  }

  app.get("/api/health", (req, res) => {
    res.json({ success: true, data: { status: "ok", mode: env.metaMode } });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/whatsapp-account", whatsappAccountRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/templates", templatesRoutes);
  app.use("/api/contacts", contactsRoutes);
  app.use("/api/campaigns", campaignsRoutes);
  app.use("/api/notifications", notificationsRoutes);
  app.use("/api/api-keys", apiKeysRoutes);
  app.use("/api/webhooks", webhooksRoutes);
  app.use("/api/conversations", conversationsRoutes);
  app.use("/api/upload", uploadRoutes);
  app.use("/api/v1", v1Routes);
  app.use("/api/triggers", triggersRoutes);
  app.use("/api/wallet", walletRoutes);
  app.use("/api/billing", billingRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
