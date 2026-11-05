import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Encrypts an HQ's keys before they go into the database (AES-256-GCM). The key is HQ_SECRET_KEY from the
 * environment (any long random string; `openssl rand -base64 32`), never stored in the database, so a
 * leaked table dump doesn't leak anyone's API keys or Google tokens.
 */
const key = () => createHash("sha256").update(env("HQ_SECRET_KEY")).digest();

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${body.toString("base64url")}`;
}

export function unseal(box: string): string | null {
  const [v, iv, tag, body] = box.split(".");
  if (v !== "v1" || !iv || !tag || !body) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
