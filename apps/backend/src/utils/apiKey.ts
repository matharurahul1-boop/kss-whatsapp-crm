import crypto from "crypto";
import { nanoid } from "nanoid";

export function generateApiKey(): { fullKey: string; prefix: string; hash: string } {
  const secret = nanoid(32);
  const fullKey = `kss_live_${secret}`;
  const prefix = fullKey.slice(0, 12);
  const hash = hashApiKey(fullKey);
  return { fullKey, prefix, hash };
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}
