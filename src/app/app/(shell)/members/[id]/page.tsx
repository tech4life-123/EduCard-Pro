import Link from "next/link";
import { notFound } from "next/navigation";
import * as z from "zod";
import { hasRole, requireOrg } from "@/lib/auth";
import { issueCard } from "@/app/actions/cards";
import { IssuePanel } from "../../cards/issue-panel";
import { createClient } from "@/lib/supabase/server";
import { setMemberStatus } from "@/app/actions/members";
import { secondaryButtonClass } from "@/components/form";
import type { CustomFieldDef } from "@/lib/member-fields";
import { MemberForm } from "../member-form";
import { PhotoCapture } from "@/components/photo-capture";
import { signedPhotoUrls } from "@/lib/photos";
import { CardSide } from "@/components/card-svg";
import { loadBranding, loadDefaultTemplateId, memberCardValues, TEMPLATE_COLUMNS } from "@/lib/templates/data";
import type { TemplateRow } from "@/lib/templates/schema";

export const metadata = { title: "Edit member · EduCard Pro" };

export default async function EditMemberPage({ params, searchParams }: PageProps<"/app/members/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const { org, role } = await requireOrg();
  const supabase = await createClient();
  const [{ data: member }, { data: defs }] = await Promise.all([
    supabase.from("members").select("*").eq("id", id).eq("organization_id", org.id).maybeSingle(),
    supabase
      .from("member_custom_field_defs")
      .select("id, key, label, field_type, options, required, sort_order")
      .eq("organization_id", org.id)
      .order("sort_order"),
  ]);
  if (!member) notFound();

  const photoUrl = member.photo_processed_path ? ((await signedPhotoUrls([member.photo_processed_path])).get(member.photo_processed_path) ?? null) : null;
  const defaultTemplateId = await loadDefaultTemplateId(org.id);
  let template: TemplateRow | null = null;
  if (defaultTemplateId) {
    const { data: t } = await supabase.from("card_templates").select(TEMPLATE_COLUMNS).eq("id", defaultTemplateId).maybeSingle();
    template = (t as unknown as TemplateRow) ?? null;
  }
  const brand = await loadBranding(org.id);
  const { data: cards } = await supabase
    .from("id_cards")
    .select("id, card_number, status, expiry_date")
    .eq("member_id", member.id)
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });
  const hasLive = (cards ?? []).some((c) => c.status === "active" || c.status === "suspended");
  const archive = setMemberStatus.bind(null, member.id, "archived");
  const restore = setMemberStatus.bind(null, member.id, "active");

  return (
    <div className="space-y-5">
      <div>
        <Link href="/app/members" className="text-sm text-slate-600 underline">
          ← Members
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{member.full_name}</h1>
        <p className="font-mono text-sm text-slate-600">{member.member_number}</p>
      </div>
      {sp.added ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          Member added. You can add a photo below.
        </p>
      ) : null}
      <PhotoCapture orgId={org.id} memberId={member.id} currentUrl={photoUrl} name={member.full_name} />
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Card preview</h2>
        {template ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {(["front", "back"] as const).map((side) => (
              <div key={side} className="flex justify-center rounded-lg bg-slate-100 p-3">
                <CardSide
                  design={side === "front" ? template.front_design : template.back_design}
                  widthMm={Number(template.width_mm)}
                  heightMm={Number(template.height_mm)}
                  data={{ values: memberCardValues(member as Record<string, unknown>, brand), photoUrl }}
                  brand={brand}
                  uid={`m-${side}`}
                  className={template.orientation === "portrait" ? "h-64 w-auto drop-shadow" : "w-full max-w-[340px] drop-shadow"}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            No default template yet. <Link href="/app/templates" className="underline">Choose one</Link> to see this member&apos;s card.
          </p>
        )}
        {template && hasRole(role, "org_admin") && member.status === "active" ? (
          <div className="border-t border-slate-200 pt-3">
            <IssuePanel
              action={issueCard.bind(null, member.id)}
              label={hasLive ? "Issue replacement card" : "Issue ID card"}
              warning={hasLive ? "The current card will be marked replaced and stop verifying." : "Creates the card number and a secure QR code."}
              template={template}
              values={memberCardValues(member as Record<string, unknown>, brand)}
              photoUrl={photoUrl}
              brand={brand}
            />
          </div>
        ) : null}
        {(cards ?? []).length > 0 ? (
          <ul className="space-y-1 border-t border-slate-200 pt-3 text-sm">
            {(cards ?? []).map((c) => (
              <li key={c.id}>
                <Link href={`/app/cards/${c.id}`} className="underline">
                  {c.card_number}
                </Link>{" "}
                <span className="capitalize text-slate-600">· {c.status}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <MemberForm
        id={member.id}
        defs={(defs ?? []) as CustomFieldDef[]}
        values={member as Record<string, string | null>}
        customValues={(member.custom_fields ?? {}) as Record<string, unknown>}
      />
      <form action={member.status === "archived" ? restore : archive} className="max-w-xs border-t border-slate-200 pt-5">
        <button type="submit" className={secondaryButtonClass + " w-full"}>
          {member.status === "archived" ? "Restore member" : "Archive member"}
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Archiving hides the member from active lists. Cards already issued keep their history.
        </p>
      </form>
    </div>
  );
}
