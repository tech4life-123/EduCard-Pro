import Link from "next/link";
import { requireOrg } from "@/lib/auth";
import { CardSide } from "@/components/card-svg";
import { loadBranding, loadDefaultTemplateId, loadTemplates, SAMPLE_VALUES } from "@/lib/templates/data";
import { styleOf } from "@/lib/templates/schema";
import { CATEGORIES } from "@/lib/templates/families";

export const metadata = { title: "Card templates · EduCard Pro" };

const STYLES = [["", "All styles"], ["plain", "Plain (no background)"], ["gradient", "Gradient"], ["solid", "Solid colour"]] as const;
const SHAPES = [["", "Any shape"], ["landscape", "Landscape"], ["portrait", "Portrait"]] as const;

const pill = (on: boolean) => "rounded-full border px-3 py-1.5 text-sm whitespace-nowrap " + (on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white");

export default async function TemplatesPage({ searchParams }: PageProps<"/app/templates">) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const cat = one("cat"), style = one("style"), shape = one("shape");
  const { org } = await requireOrg();
  const [all, brand, defaultId] = await Promise.all([loadTemplates(org.id), loadBranding(org.id), loadDefaultTemplateId(org.id)]);
  const withStyle = all.map((t) => ({ t, style: styleOf(t.front_design) }));
  const shown = withStyle.filter(({ t, style: s }) => (!cat || t.category === cat) && (!style || s === style) && (!shape || t.orientation === shape));
  const href = (o: Record<string, string>) => {
    const q = new URLSearchParams({ cat, style, shape, ...o });
    for (const [k, v] of [...q]) if (!v) q.delete(k);
    const qs = q.toString();
    return qs ? `/app/templates?${qs}` : "/app/templates";
  };
  const cats = [...new Set(all.map((t) => t.category))];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Card templates</h1>
        <p className="text-sm text-slate-600">{all.length} designs. Previews use sample data and your own colours and logo.</p>
      </div>
      <div className="space-y-2">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Link href={href({ cat: "" })} className={pill(!cat)}>All categories</Link>
          {cats.map((c) => (
            <Link key={c} href={href({ cat: c })} className={pill(cat === c)}>
              {CATEGORIES[c]?.name ?? c}
            </Link>
          ))}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {STYLES.map(([v, l]) => (
            <Link key={v} href={href({ style: v })} className={pill(style === v)}>{l}</Link>
          ))}
          <span className="mx-1 self-center text-slate-300">|</span>
          {SHAPES.map(([v, l]) => (
            <Link key={v} href={href({ shape: v })} className={pill(shape === v)}>{l}</Link>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">No templates match these filters.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(({ t, style: s }) => (
            <li key={t.id}>
              <Link href={`/app/templates/${t.id}`} className="block space-y-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-400">
                <div className="flex h-52 items-center justify-center rounded-lg bg-slate-100 p-3">
                  <CardSide
                    design={t.front_design}
                    widthMm={Number(t.width_mm)}
                    heightMm={Number(t.height_mm)}
                    data={{ values: { ...SAMPLE_VALUES, org_name: brand.orgName, org_contact: brand.contact } }}
                    brand={brand}
                    uid={`l-${t.id}`}
                    className={t.orientation === "portrait" ? "h-full w-auto drop-shadow" : "max-h-full w-full max-w-[300px] drop-shadow"}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.name}</p>
                    <p className="text-xs capitalize text-slate-500">
                      {CATEGORIES[t.category]?.name ?? t.category} · {t.orientation} · {s}
                      {t.organization_id ? " · yours" : ""}
                    </p>
                  </div>
                  {t.id === defaultId ? <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Default</span> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
