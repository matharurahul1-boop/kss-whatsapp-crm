import { Router } from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { createClient } from "@supabase/supabase-js";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { env } from "../config/env";

const router = Router();
router.use(requireAuth);

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/aac": "aac",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
};

const uploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  data: z.string().min(1), // base64
});

// ── Supabase Storage upload ──────────────────────────────────────────────────
async function uploadToSupabase(base64Data: string, mimeType: string): Promise<string> {
  const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey);
  const ext = ALLOWED_MIME[mimeType] ?? "bin";
  const filePath = `media/${nanoid(12)}.${ext}`;
  const buffer = Buffer.from(base64Data, "base64");

  const { error } = await supabase.storage
    .from(env.supabaseStorageBucket)
    .upload(filePath, buffer, { contentType: mimeType, upsert: false });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(env.supabaseStorageBucket).getPublicUrl(filePath);
  return data.publicUrl;
}

// ── Local disk fallback (dev only) ───────────────────────────────────────────
function saveToLocalDisk(base64Data: string, mimeType: string): string {
  const ext = ALLOWED_MIME[mimeType] ?? "bin";
  const UPLOADS_DIR = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const filename = `${nanoid(12)}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), Buffer.from(base64Data, "base64"));
  const baseUrl = env.serverBaseUrl || `http://localhost:${env.port}`;
  return `${baseUrl}/uploads/${filename}`;
}

// POST /api/upload/media
router.post(
  "/media",
  asyncHandler(async (req, res) => {
    const { filename, mimeType, data } = uploadSchema.parse(req.body);

    if (!ALLOWED_MIME[mimeType]) {
      throw new ApiError(400, "UNSUPPORTED_TYPE", `File type "${mimeType}" is not supported.`);
    }

    const bytes = Math.ceil((data.length * 3) / 4);
    if (bytes > 10 * 1024 * 1024) {
      throw new ApiError(400, "FILE_TOO_LARGE", "File exceeds 10 MB limit.");
    }

    let publicUrl: string;

    if (env.supabaseUrl && env.supabaseServiceKey) {
      // Production: Supabase Storage (public URL, works with Meta API)
      try {
        publicUrl = await uploadToSupabase(data, mimeType);
      } catch (e) {
        throw new ApiError(500, "UPLOAD_FAILED", (e as Error).message);
      }
    } else {
      // Dev fallback: local disk
      publicUrl = saveToLocalDisk(data, mimeType);
    }

    res.json({ success: true, data: { url: publicUrl, originalName: filename } });
  })
);

export default router;
