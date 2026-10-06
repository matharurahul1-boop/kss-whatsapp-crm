import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { hashApiKey } from "../utils/apiKey";

export interface ApiKeyRequest extends Request {
  apiKeyId?: string;
}

export async function requireApiKey(req: ApiKeyRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const key = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!key) {
    res.status(401).json({ success: false, error: { code: "MISSING_API_KEY", message: "Authorization header with Bearer API key is required" } });
    return;
  }

  const hash = hashApiKey(key);
  const record = await prisma.apiKey.findUnique({ where: { keyHash: hash } });

  if (!record || !record.enabled || record.revokedAt) {
    res.status(401).json({ success: false, error: { code: "INVALID_API_KEY", message: "API key is invalid, disabled, or revoked" } });
    return;
  }

  await prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });

  req.apiKeyId = record.id;
  next();
}
