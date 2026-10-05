import Link from "next/link";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buttonClass } from "@/components/form";

export const metadata = { title: "Batches · EduCard Pro" };

export default async function BatchesPage() {
  const { org } = await requireOrg();
  const supabase = await createClient();
  const { data } = await supabase
    .from("card_batches")
    .select("id, name, status, total_records, generated_count, created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Batches</h1>
          <p className="text-sm text-slate-600">Add many members and issue their cards in one go.</p>
        </div>
        <Link href="/app/batches/new" className={buttonClass}>
          New batch
        </Link>
      </div>
      {(data ?? []).length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">No batches yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {data!.map((b) => (
            <li key={b.id}>
              <Link href={`/app/batches/${b.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.name}</p>
                  <p className="text-xs text-slate-600">
                    {b.total_records} rows · {b.generated_count} cards · {new Date(b.created_at).toLocaleDateString("en-GB", { timeZone: "UTC" })}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize">{b.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
