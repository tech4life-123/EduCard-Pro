import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashCredential, hashIp, isWellFormedToken } from "@/lib/credentials";

export type VerifyResult =
  | "VERIFIED"
  | "EXPIRED"
  | "REVOKED"
  | "SUSPENDED"
  | "REPLACED"
  | "INVALID"
  | "RATE_LIMITED"
  | "UNAVAILABLE";

export interface VerifyOutcome {
  result: VerifyResult;
  organization?: string;
  card_number?: string;
  issued?: string;
  wording?: string | null;
  public_fields?: Record<string, string>;
}

/** Verify a QR token. All failure modes collapse to INVALID so callers can't enumerate credentials. */
export async function verifyToken(token: string): Promise<VerifyOutcome> {
  if (!isWellFormedToken(token)) {
    return { result: "INVALID" };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("verify_credential", {
      p_hash: hashCredential(token),
      p_ip_hash: hashIp(ip),
    });
    if (error || !data) {
      return { result: "UNAVAILABLE" };
    }
    return data as VerifyOutcome;
  } catch {
    return { result: "UNAVAILABLE" };
  }
}
