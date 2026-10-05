import Link from "next/link";
import { requireOrg } from "@/lib/auth";
import { CardSide } from "@/components/card-svg";
import { loadBranding, loadDefaultTemplateId, loadTemplates, SAMPLE_VALUES } from "@/lib/templates/data";

export const metadata = { title: "Card templates · EduCard Pro" };

export default async function TemplatesPage() {
  const { org } = await requireOrg();
  const [templates, brand, defaultId] = await Promise.all([loadTemplates(org.id), loadBranding(org.id), loadDefaultTemplateId(org.id)]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Card templates</h1>
        <p className="text-sm text-slate-600">Pick a design for your cards. Previews use sample data and your branding.</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {templates.map((t) => (
          <li key={t.id}>
            <Link href={`/app/templates/${t.id}`} className="block space-y-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400">
              <div className="flex justify-center rounded-lg bg-slate-100 p-3">
                <CardSide
                  design={t.front_design}
                  widthMm={Number(t.width_mm)}
                  heightMm={Number(t.height_mm)}
                  data={{ values: { ...SAMPLE_VALUES, org_name: brand.orgName, org_contact: brand.contact } }}
                  brand={brand}
                  uid={`l-${t.id}`}
                  className={t.orientation === "portrait" ? "h-56 w-auto drop-shadow" : "w-full max-w-[320px] drop-shadow"}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs capitalize text-slate-500">
                    {t.category} · {t.orientation}
                    {t.organization_id ? " · yours" : ""}
                  </p>
                </div>
                {t.id === defaultId ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Default</span> : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
