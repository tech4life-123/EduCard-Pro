import { redirect } from "next/navigation";
import { hasRole, requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadBranding } from "@/lib/templates/data";
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY } from "@/lib/templates/schema";
import { BrandingForm } from "./branding-form";
import { LogoUpload } from "./logo-upload";

export const metadata = { title: "Branding · EduCard Pro" };

export default async function BrandingPage() {
  const { org, role } = await requireOrg();
  if (!hasRole(role, "org_admin")) redirect("/app");
  const supabase = await createClient();
  const [{ data: o }, brand] = await Promise.all([
    supabase.from("organizations").select("primary_color, secondary_color, contact_email, contact_phone, address").eq("id", org.id).maybeSingle(),
    loadBranding(org.id),
  ]);
  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Branding</h1>
        <p className="text-sm text-slate-600">Colors, logo and contact details used on your cards.</p>
      </div>
      <LogoUpload orgId={org.id} currentUrl={brand.logoUrl} />
      <BrandingForm
        values={{
          primary_color: o?.primary_color ?? DEFAULT_PRIMARY,
          secondary_color: o?.secondary_color ?? DEFAULT_SECONDARY,
          contact_email: o?.contact_email ?? "",
          contact_phone: o?.contact_phone ?? "",
          address: o?.address ?? "",
        }}
      />
    </div>
  );
}
