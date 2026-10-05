import Link from "next/link";
import { redirect } from "next/navigation";
import { hasRole, requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Scans · EduCard Pro" };

const TONE: Record<string, string> = {
  VERIFIED: "bg-emerald-100 text-emerald-800",
  EXPIRED: "bg-amber-100 text-amber-900",
  SUSPENDED: "bg-amber-100 text-amber-900",
  REPLACED: "bg-amber-100 text-amber-900",
  REVOKED: "bg-red-100 text-red-800",
};

function weekAgo() {
  return new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
}

export default async function VerificationsPage() {
  const { org, role } = await requireOrg();
  if (!hasRole(role, "org_admin")) redirect("/app");
  const supabase = await createClient();
  const since = weekAgo();
  const [{ data: events }, { count: week }, { count: problems }] = await Promise.all([
    supabase.from("verification_events").select("id, result, created_at, card_id, id_cards(card_number, members(full_name))").eq("organization_id", org.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("verification_events").select("id", { count: "exact", head: true }).eq("organization_id", org.id).gte("created_at", since),
    supabase.from("verification_events").select("id", { count: "exact", head: true }).eq("organization_id", org.id).gte("created_at", since).neq("result", "VERIFIED"),
  ]);
  type Row = { id: number; result: string; created_at: string; card_id: string | null; id_cards: { card_number: string; members: { full_name: string } | { full_name: string }[] | null } | { card_number: string; members: { full_name: string } | { full_name: string }[] | null }[] | null };
  const rows = (events ?? []) as unknown as Row[];
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scans</h1>
          <p className="text-sm text-slate-600">Every time one of your cards is scanned. Visitors&apos; addresses are never stored.</p>
        </div>
        <Link href="/app/settings/verification" className="text-sm underline">
          What scanners see
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-2xl font-bold">{week ?? 0}</p>
          <p className="text-xs text-slate-600">Scans in 7 days</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-2xl font-bold">{problems ?? 0}</p>
          <p className="text-xs text-slate-600">Not valid (7 days)</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">No scans yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {rows.map((e) => {
            const c = Array.isArray(e.id_cards) ? e.id_cards[0] : e.id_cards;
            const m = c ? (Array.isArray(c.members) ? c.members[0] : c.members) : null;
            return (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  {e.card_id ? (
                    <Link href={`/app/cards/${e.card_id}`} className="block truncate font-medium underline">
                      {m?.full_name ?? "Member"} · {c?.card_number}
                    </Link>
                  ) : (
                    <p className="font-medium">Unknown card</p>
                  )}
                  <p className="text-xs text-slate-500">{new Date(e.created_at).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC</p>
                </div>
                <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + (TONE[e.result] ?? "bg-slate-100")}>{e.result.toLowerCase()}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
