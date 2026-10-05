import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Uptime check for monitors. Reveals nothing beyond up/down. */
export async function GET() {
  let db = false;
  try {
    const { error } = await createAdminClient().from("organizations").select("id", { head: true, count: "exact" }).limit(1);
    db = !error;
  } catch {
    db = false;
  }
  return NextResponse.json({ status: db ? "ok" : "degraded" }, { status: db ? 200 : 503, headers: { "cache-control": "no-store" } });
}
