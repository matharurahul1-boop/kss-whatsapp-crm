import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import { env } from "../config/env";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

router.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const { name, email, password } = signupSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ success: false, error: { code: "EMAIL_IN_USE", message: "Email already registered" } });
      return;
    }

    // Create user in Supabase Auth
    const { data: sbData, error: sbError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (sbError) {
      res.status(500).json({ success: false, error: { code: "SUPABASE_ERROR", message: sbError.message } });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: "ADMIN" },
    });

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    res.cookie("access_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.nodeEnv === "production",
      maxAge: 8 * 60 * 60 * 1000,
    });

    await recordAudit({ userId: user.id, action: "SIGNUP", description: `${user.email} registered` });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        supabaseId: sbData.user?.id,
      },
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    res.cookie("access_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.nodeEnv === "production",
      maxAge: 8 * 60 * 60 * 1000,
    });

    await recordAudit({ userId: user.id, action: "LOGIN", description: `${user.email} signed in` });

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      },
    });
  })
);

router.post("/logout", (req, res) => {
  res.clearCookie("access_token");
  res.json({ success: true, data: { message: "Logged out" } });
});

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "User not found" } });
      return;
    }
    res.json({ success: true, data: { id: user.id, name: user.name, email: user.email, role: user.role } });
  })
);

export default router;
