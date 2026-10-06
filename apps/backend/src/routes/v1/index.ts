import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireApiKey, ApiKeyRequest } from "../../middleware/apiKey";
import whatsappRoutes from "./whatsapp.v1.routes";
import templatesRoutes from "./templates.v1.routes";
import contactsRoutes from "./contacts.v1.routes";
import campaignsRoutes from "./campaigns.v1.routes";
import notificationsRoutes from "./notifications.v1.routes";

const router = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: ApiKeyRequest) => req.apiKeyId ?? req.ip ?? "anonymous",
  handler: (req, res) => {
    res.status(429).json({ success: false, error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down." } });
  },
});

router.use(requireApiKey);
router.use(limiter);

router.use("/whatsapp", whatsappRoutes);
router.use("/templates", templatesRoutes);
router.use("/contacts", contactsRoutes);
router.use("/campaigns", campaignsRoutes);
router.use("/notifications", notificationsRoutes);

export default router;
