import Link from "next/link";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Cards · EduCard Pro" };

const STATUSES = ["active", "suspended", "revoked", "lost", "replaced", "expired"] as const;
const TONE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  suspended: "bg-amber-100 text-amber-900",
  revoked: "bg-red-100 text-red-800",
  lost: "bg-red-100 text-red-800",
  replaced: "bg-slate-200 text-slate-700",
  expired: "bg-slate-200 text-slate-700",
  draft: "bg-slate-100 text-slate-600",
};

export default async function CardsPage({ searchParams }: PageProps<"/app/cards">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" && (STATUSES as readonly string[]).includes(sp.status) ? sp.status : "";
  const { org } = await requireOrg();
  const supabase = await createClient();
  let q = supabase
    .from("id_cards")
    .select("id, card_number, status, issue_date, expiry_date, members(full_name, member_number)")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) q = q.eq("status", status as (typeof STATUSES)[number]);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    card_number: string;
    status: string;
    issue_date: string | null;
    expiry_date: string | null;
    members: { full_name: string; member_number: string } | { full_name: string; member_number: string }[] | null;
  }>;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ID cards</h1>
        <p className="text-sm text-slate-600">Issue a card from a member&apos;s page. Cards are listed newest first.</p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/app/cards" className={"rounded-full border px-3 py-1.5 " + (!status ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300")}>
          All
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/app/cards?status=${s}`} className={"rounded-full border px-3 py-1.5 capitalize " + (status === s ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300")}>
            {s}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">No cards yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {rows.map((c) => {
            const m = Array.isArray(c.members) ? c.members[0] : c.members;
            return (
              <li key={c.id}>
                <Link href={`/app/cards/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m?.full_name ?? "Member"}</p>
                    <p className="font-mono text-xs text-slate-600">
                      {c.card_number}
                      {c.expiry_date ? ` · expires ${c.expiry_date}` : ""}
                    </p>
                  </div>
                  <span className={"rounded-full px-2 py-0.5 text-xs font-medium capitalize " + (TONE[c.status] ?? "")}>{c.status}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
