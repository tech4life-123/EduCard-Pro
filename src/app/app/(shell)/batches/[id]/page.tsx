import Link from "next/link";
import { notFound } from "next/navigation";
import * as z from "zod";
import { hasRole, requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Issue } from "@/lib/batch-import";
import { BatchRunner } from "./batch-runner";
import { PrintForm } from "@/components/print-form";

export const metadata = { title: "Batch · EduCard Pro" };

const TONE = { ok: "bg-emerald-100 text-emerald-800", warning: "bg-amber-100 text-amber-900", error: "bg-red-100 text-red-800" } as const;

export default async function BatchPage({ params }: PageProps<"/app/batches/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { org, role } = await requireOrg();
  const supabase = await createClient();
  const { data: batch } = await supabase.from("card_batches").select("*").eq("id", id).eq("organization_id", org.id).maybeSingle();
  if (!batch) notFound();
  const { data: recs } = await supabase
    .from("batch_records")
    .select("id, row_number, raw_data, severity, issues, member_id, card_id")
    .eq("batch_id", id)
    .eq("organization_id", org.id)
    .order("row_number")
    .limit(500);
  const rows = (recs ?? []) as unknown as Array<{ id: string; row_number: number; raw_data: { member?: { first_name?: string; last_name?: string; student_number?: string } }; severity: "ok" | "warning" | "error"; issues: Issue[]; member_id: string | null; card_id: string | null }>;
  const count = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).length;
  const errors = count((r) => r.severity === "error");
  const needMembers = count((r) => r.severity !== "error" && !r.member_id);
  const needCards = count((r) => r.severity !== "error" && !!r.member_id && !r.card_id);
  const cards = count((r) => !!r.card_id);
  const isAdmin = hasRole(role, "org_admin");

  return (
    <div className="space-y-5">
      <div>
        <Link href="/app/batches" className="text-sm text-slate-600 underline">
          ← Batches
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{batch.name}</h1>
        <p className="text-sm capitalize text-slate-600">{batch.status}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Rows", rows.length],
          ["Problems", errors],
          ["Members added", count((r) => !!r.member_id)],
          ["Cards issued", cards],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-2xl font-bold">{v}</p>
            <p className="text-xs text-slate-600">{l}</p>
          </div>
        ))}
      </div>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="font-semibold">1. Add members</h2>
          <p className="mb-2 text-sm text-slate-600">Rows without problems become members. Rows with problems are skipped, so you can fix the file and upload those rows again as a new batch.</p>
          <BatchRunner batchId={id} step="members" label="Add members" pending={needMembers} />
        </div>
        <div className="border-t border-slate-200 pt-4">
          <h2 className="font-semibold">2. Issue cards</h2>
          <p className="mb-2 text-sm text-slate-600">Creates a card number and secure QR for each member, using your default template. Photos can be added on each member&apos;s page.</p>
          <BatchRunner batchId={id} step="cards" label="Issue cards" pending={needCards} disabled={isAdmin ? undefined : "Only admins can issue cards."} />
        </div>
      </section>

      {isAdmin && cards > 0 ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">3. Print</h2>
          <PrintForm batchId={id} parts={Math.ceil(cards / 50)} />
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-200">
          {rows.map((r) => (
            <li key={r.id} className="space-y-1 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate">
                  <span className="text-slate-500">#{r.row_number}</span> <span className="font-medium">{[r.raw_data.member?.first_name, r.raw_data.member?.last_name].filter(Boolean).join(" ") || "(no name)"}</span>
                </p>
                <span className="flex items-center gap-1.5">
                  {r.card_id ? <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">Card</span> : r.member_id ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">Member</span> : null}
                  <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + TONE[r.severity]}>{r.severity === "ok" ? "OK" : r.severity === "warning" ? "Check" : "Problem"}</span>
                </span>
              </div>
              {r.issues?.map((i, n) => (
                <p key={n} className={i.severity === "error" ? "text-red-700" : "text-amber-800"}>
                  {i.field}: {i.message}
                </p>
              ))}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
