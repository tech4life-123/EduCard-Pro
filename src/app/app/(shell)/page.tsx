import Link from "next/link";
import { requireOrg, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buttonClass, secondaryButtonClass } from "@/components/form";

export const metadata = { title: "Dashboard · EduCard Pro" };

async function count(table: "members" | "id_cards", orgId: string, filter?: [string, string]) {
  const supabase = await createClient();
  let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("organization_id", orgId);
  if (filter) q = q.eq(filter[0], filter[1]);
  const { count: n } = await q;
  return n ?? 0;
}

export default async function DashboardPage() {
  const { org, role } = await requireOrg();
  const [members, activeMembers, activeCards, draftCards] = await Promise.all([
    count("members", org.id),
    count("members", org.id, ["status", "active"]),
    count("id_cards", org.id, ["status", "active"]),
    count("id_cards", org.id, ["status", "draft"]),
  ]);

  const stats = [
    { label: "Members", value: members },
    { label: "Active members", value: activeMembers },
    { label: "Active cards", value: activeCards },
    { label: "Draft cards", value: draftCards },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-600">
          Card prefix <span className="font-mono">{org.card_prefix}</span> · your role: {role.replace("org_", "")}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <dt className="text-sm text-slate-600">{s.label}</dt>
            <dd className="mt-1 text-3xl font-bold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-3">
        <Link href="/app/members/new" className={buttonClass}>
          Add a member
        </Link>
        <Link href="/app/members" className={secondaryButtonClass}>
          View members
        </Link>
        {hasRole(role, "org_admin") ? (
          <Link href="/app/settings/fields" className={secondaryButtonClass}>
            Custom fields
          </Link>
        ) : null}
      </div>

      {members === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-5">
          <h2 className="font-semibold">Start here</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>Optional: add custom fields your cards need (e.g. Blood group, Church branch).</li>
            <li>Add your first member.</li>
            <li>Photo capture and card design arrive in the next phases.</li>
          </ol>
        </section>
      ) : null}
    </div>
  );
}
