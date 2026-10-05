"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg, hasRole } from "@/lib/auth";
import { parseCsv } from "@/lib/csv";
import { MAX_BYTES, severityOf, validateRows, type Issue } from "@/lib/batch-import";
import { createActiveCard } from "@/lib/cards-core";
import type { CustomFieldDef } from "@/lib/member-fields";
import type { ActionState } from "@/lib/action-state";

const nameSchema = z.string().trim().min(2, "Enter a batch name.").max(80);
const CHUNK = 20;

export async function createBatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { org, user } = await requireOrg();
  const name = nameSchema.safeParse(formData.get("name"));
  if (!name.success) return { fieldErrors: { name: [name.error.issues[0].message] }, error: "Please fix the highlighted fields." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { fieldErrors: { file: ["Choose a CSV file."] }, error: "Please fix the highlighted fields." };
  if (!/\.csv$/i.test(file.name)) return { fieldErrors: { file: ["Save your spreadsheet as CSV first (File → Save as → CSV)."] }, error: "Please fix the highlighted fields." };
  if (file.size > MAX_BYTES) return { fieldErrors: { file: ["File is too large (max 1 MB)."] }, error: "Please fix the highlighted fields." };

  const supabase = await createClient();
  const [{ data: defs }, { data: nums }] = await Promise.all([
    supabase.from("member_custom_field_defs").select("id, key, label, field_type, options, required, sort_order").eq("organization_id", org.id),
    supabase.from("members").select("student_number, employee_number").eq("organization_id", org.id).limit(20000),
  ]);
  const existing = {
    student: new Set((nums ?? []).map((n) => n.student_number).filter((v): v is string => !!v)),
    employee: new Set((nums ?? []).map((n) => n.employee_number).filter((v): v is string => !!v)),
  };
  const { rows, headerIssues } = validateRows(parseCsv(await file.text()), (defs ?? []) as CustomFieldDef[], existing);
  if (headerIssues.length) return { fieldErrors: { file: headerIssues }, error: "That file could not be used." };

  const { data: batch, error } = await supabase
    .from("card_batches")
    .insert({ organization_id: org.id, name: name.data, status: "ready", total_records: rows.length, created_by: user.id })
    .select("id")
    .single();
  if (error || !batch) return { error: "Could not create the batch. Please try again." };

  const records = rows.map((r) => ({
    organization_id: org.id,
    batch_id: batch.id,
    row_number: r.rowNumber,
    raw_data: { member: r.member, raw: r.raw },
    severity: severityOf(r.issues),
    issues: r.issues,
  }));
  for (let i = 0; i < records.length; i += 200) {
    const { error: rErr } = await supabase.from("batch_records").insert(records.slice(i, i + 200));
    if (rErr) {
      await supabase.from("card_batches").delete().eq("id", batch.id);
      return { error: "Could not save the rows. Please try again." };
    }
  }
  revalidatePath("/app/batches");
  redirect(`/app/batches/${batch.id}`);
}

export type StepResult = { remaining: number; processed: number; error?: string };

type Rec = { id: string; row_number: number; raw_data: { member: Record<string, unknown> }; issues: Issue[]; member_id: string | null };

async function failRecord(supabase: Awaited<ReturnType<typeof createClient>>, rec: Rec, message: string) {
  await supabase
    .from("batch_records")
    .update({ severity: "error", issues: [...(rec.issues ?? []), { field: "row", message, severity: "error" }] })
    .eq("id", rec.id);
}

/** Process up to CHUNK rows per call (keeps each request short on serverless). The client repeats until remaining = 0. */
export async function processBatch(batchId: string, step: "members" | "cards"): Promise<StepResult> {
  const { org, role, user } = await requireOrg();
  if (!z.uuid().safeParse(batchId).success) return { remaining: 0, processed: 0, error: "Batch not found." };
  if (step === "cards" && !hasRole(role, "org_admin")) return { remaining: 0, processed: 0, error: "Only admins can issue cards." };
  const supabase = await createClient();
  const { data: batch } = await supabase.from("card_batches").select("id, status, template_id").eq("id", batchId).eq("organization_id", org.id).maybeSingle();
  if (!batch) return { remaining: 0, processed: 0, error: "Batch not found." };

  const pendingQuery = () => {
    let q = supabase
      .from("batch_records")
      .select("id, row_number, raw_data, issues, member_id", { count: "exact" })
      .eq("batch_id", batchId)
      .eq("organization_id", org.id)
      .neq("severity", "error")
      .order("row_number");
    q = step === "members" ? q.is("member_id", null) : q.not("member_id", "is", null).is("card_id", null);
    return q;
  };

  let templateId = batch.template_id;
  let validity = 12;
  if (step === "cards") {
    const { data: s } = await supabase.from("organization_settings").select("default_template_id, card_validity_months").eq("organization_id", org.id).maybeSingle();
    templateId = templateId ?? s?.default_template_id ?? null;
    validity = s?.card_validity_months ?? 12;
    if (!templateId) return { remaining: 0, processed: 0, error: "Choose a default template first (Templates page)." };
    if (!batch.template_id) await supabase.from("card_batches").update({ template_id: templateId }).eq("id", batchId);
  }

  const { data, count } = await pendingQuery().limit(CHUNK);
  const recs = (data ?? []) as unknown as Rec[];
  let processed = 0;
  if (recs.length && batch.status !== "generating") await supabase.from("card_batches").update({ status: "generating" }).eq("id", batchId);

  for (const rec of recs) {
    if (step === "members") {
      const m = rec.raw_data.member as Record<string, unknown>;
      const { data: number } = await supabase.rpc("next_member_number", { p_org: org.id });
      if (!number) {
        await failRecord(supabase, rec, "Could not allocate a member number.");
        continue;
      }
      const { data: created, error } = await supabase
        .from("members")
        .insert({ ...m, organization_id: org.id, member_number: number as string, created_by: user.id, status: "active" })
        .select("id")
        .single();
      if (error || !created) {
        await failRecord(supabase, rec, error?.code === "23505" ? "A member with this student/employee number already exists." : "Could not add this member.");
        continue;
      }
      await supabase.from("batch_records").update({ member_id: created.id }).eq("id", rec.id);
    } else {
      const { data: live } = await supabase
        .from("id_cards")
        .select("id")
        .eq("member_id", rec.member_id!)
        .eq("organization_id", org.id)
        .in("status", ["active", "suspended"])
        .limit(1)
        .maybeSingle();
      if (live) {
        await failRecord(supabase, rec, "Skipped: this member already has an active card.");
        continue;
      }
      const made = await createActiveCard(supabase, { orgId: org.id, memberId: rec.member_id!, templateId: templateId!, validityMonths: validity, userId: user.id, batchId });
      if (!made.ok) {
        await failRecord(supabase, rec, made.error);
        continue;
      }
      await supabase.from("batch_records").update({ card_id: made.cardId }).eq("id", rec.id);
    }
    processed++;
  }

  const remaining = Math.max(0, (count ?? 0) - recs.length);
  if (remaining === 0) {
    const { count: pendingCards } = await supabase
      .from("batch_records")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batchId)
      .neq("severity", "error")
      .not("member_id", "is", null)
      .is("card_id", null);
    const { count: made } = await supabase.from("batch_records").select("id", { count: "exact", head: true }).eq("batch_id", batchId).not("card_id", "is", null);
    await supabase
      .from("card_batches")
      .update(
        step === "cards" && (pendingCards ?? 0) === 0
          ? { status: "completed", completed_at: new Date().toISOString(), generated_count: made ?? 0 }
          : { status: "ready", generated_count: made ?? 0 },
      )
      .eq("id", batchId);
  }
  revalidatePath(`/app/batches/${batchId}`);
  revalidatePath("/app/batches");
  revalidatePath("/app/members");
  revalidatePath("/app");
  return { remaining, processed };
}
