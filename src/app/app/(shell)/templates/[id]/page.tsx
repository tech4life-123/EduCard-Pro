import Link from "next/link";
import { notFound } from "next/navigation";
import * as z from "zod";
import { hasRole, requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedPhotoUrls } from "@/lib/photos";
import { CardSide } from "@/components/card-svg";
import { buttonClass } from "@/components/form";
import { addTemplateFields, setDefaultTemplate } from "@/app/actions/templates";
import { loadBranding, loadDefaultTemplateId, memberCardValues, SAMPLE_VALUES, TEMPLATE_COLUMNS } from "@/lib/templates/data";
import { customKeysUsed, type TemplateRow } from "@/lib/templates/schema";
import { CustomizeForm } from "./customize-form";

export const metadata = { title: "Template · EduCard Pro" };

export default async function TemplatePage({ params, searchParams }: PageProps<"/app/templates/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const { org, role } = await requireOrg();
  const supabase = await createClient();
  const { data } = await supabase
    .from("card_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("id", id)
    .eq("is_active", true)
    .or(`organization_id.is.null,organization_id.eq.${org.id}`)
    .maybeSingle();
  if (!data) notFound();
  const t = data as unknown as TemplateRow;

  const [brand, defaultId, { data: defs }] = await Promise.all([
    loadBranding(org.id),
    loadDefaultTemplateId(org.id),
    supabase.from("member_custom_field_defs").select("key").eq("organization_id", org.id),
  ]);
  const have = new Set((defs ?? []).map((d) => d.key));
  const missing = customKeysUsed(t.front_design, t.back_design).filter((k) => !have.has(k));
  const { data: members } = await supabase
    .from("members")
    .select("*")
    .eq("organization_id", org.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(30);
  const memberId = typeof sp.member === "string" ? sp.member : undefined;
  const member = members?.find((m) => m.id === memberId) ?? null;
  const photo = member?.photo_processed_path ? ((await signedPhotoUrls([member.photo_processed_path])).get(member.photo_processed_path) ?? null) : null;
  const values = member ? memberCardValues(member, brand) : { ...SAMPLE_VALUES, org_name: brand.orgName, org_contact: brand.contact };
  const isAdmin = hasRole(role, "org_admin");
  const makeDefault = setDefaultTemplate.bind(null, t.id);
  const size = { widthMm: Number(t.width_mm), heightMm: Number(t.height_mm) };
  const cls = t.orientation === "portrait" ? "h-80 w-auto drop-shadow-md" : "w-full max-w-[460px] drop-shadow-md";

  return (
    <div className="space-y-5">
      <div>
        <Link href="/app/templates" className="text-sm text-slate-600 underline">
          ← Templates
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{t.name}</h1>
        <p className="text-sm text-slate-600">
          Standard ID card size ({size.widthMm} × {size.heightMm} mm). The QR code on printed cards is generated when a card is issued.
        </p>
      </div>

      {missing.length > 0 ? (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p>
            This design shows custom fields that are not set up yet: <span className="font-mono">{missing.join(", ")}</span>.
          </p>
          {isAdmin ? (
            <form action={addTemplateFields.bind(null, t.id)} className="mt-2">
              <button type="submit" className={buttonClass}>Add these fields</button>
              <span className="ml-2 text-xs">They are also added automatically when you use or customize this design.</span>
            </form>
          ) : (
            <p className="mt-1">Ask an administrator to add them under Fields.</p>
          )}
        </div>
      ) : null}

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="member" className="block text-sm font-medium text-slate-700">
            Preview with
          </label>
          <select id="member" name="member" defaultValue={member?.id ?? ""} className="block rounded-lg border border-slate-300 bg-white px-3 py-2.5">
            <option value="">Sample data</option>
            {(members ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name} ({m.member_number})
              </option>
            ))}
          </select>
        </div>
        <button className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 font-medium hover:bg-slate-50">Show</button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {(["front", "back"] as const).map((side) => (
          <div key={side} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium capitalize text-slate-700">{side}</p>
            <div className="flex justify-center rounded-lg bg-slate-100 p-4">
              <CardSide
                design={side === "front" ? t.front_design : t.back_design}
                {...size}
                data={{ values, photoUrl: photo }}
                brand={brand}
                uid={`${side}-${t.id}`}
                className={cls}
                safeMm={Number(t.safe_zone_mm)}
              />
            </div>
          </div>
        ))}
      </div>

      {isAdmin ? (
        <div className="flex flex-wrap items-center gap-3">
          {t.id === defaultId ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-800">This is your default template</span>
          ) : (
            <form action={makeDefault}>
              <button type="submit" className={buttonClass}>
                Use as default
              </button>
            </form>
          )}
          <Link href="/app/settings/branding" className="text-sm underline">
            Edit branding (colors, logo, contact)
          </Link>
        </div>
      ) : null}

      {isAdmin ? <CustomizeForm baseId={t.id} defaultName={t.organization_id ? t.name : `${t.name} (${org.name})`} /> : null}
    </div>
  );
}
