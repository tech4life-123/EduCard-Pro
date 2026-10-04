import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** 256-bit opaque token, base64url. This is the ONLY thing encoded in the QR (as part of a URL). */
export function generateCredentialToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hex. The database stores only this hash, never the plaintext token. */
export function hashCredential(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Token shape check: 32 bytes base64url = 43 chars. Reject early without touching the database. */
export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function verifyUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  return `${base}/verify/${token}`;
}

/** Daily-salted IP hash for rate limiting; raw IPs are never stored. */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "";
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${salt}|${day}|${ip}`, "utf8").digest("hex");
}
