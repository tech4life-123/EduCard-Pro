import { redirect } from "next/navigation";
import { hasRole, requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { VerificationForm } from "./verification-form";

export const metadata = { title: "Verification settings · EduCard Pro" };

export default async function VerificationSettingsPage() {
  const { org, role } = await requireOrg();
  if (!hasRole(role, "org_admin")) redirect("/app");
  const supabase = await createClient();
  const [{ data: s }, { data: o }] = await Promise.all([
    supabase.from("organization_settings").select("public_verify_fields").eq("organization_id", org.id).maybeSingle(),
    supabase.from("organizations").select("verification_wording").eq("id", org.id).maybeSingle(),
  ]);
  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Verification settings</h1>
        <p className="text-sm text-slate-600">Choose what someone sees when they scan a valid card. By default only your organization, the card number, and issue and expiry dates are shown.</p>
      </div>
      <VerificationForm selected={s?.public_verify_fields ?? []} wording={o?.verification_wording ?? ""} />
    </div>
  );
}
