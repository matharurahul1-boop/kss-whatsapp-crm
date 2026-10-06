import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import path from "path";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

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

export function createApp() {
  const app = express();

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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
