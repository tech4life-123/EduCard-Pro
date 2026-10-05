import Link from "next/link";
import { notFound } from "next/navigation";
import * as z from "zod";
import { hasRole, requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedPhotoUrls } from "@/lib/photos";
import { CardSide } from "@/components/card-svg";
import { secondaryButtonClass } from "@/components/form";
import { changeCardStatus, regenerateQr } from "@/app/actions/cards";
import { loadBranding, memberCardValues, TEMPLATE_COLUMNS } from "@/lib/templates/data";
import type { TemplateRow } from "@/lib/templates/schema";
import { IssuePanel } from "../issue-panel";

export const metadata = { title: "Card · EduCard Pro" };

export default async function CardPage({ params }: PageProps<"/app/cards/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { org, role } = await requireOrg();
  const supabase = await createClient();
  const { data: card } = await supabase.from("id_cards").select("*").eq("id", id).eq("organization_id", org.id).maybeSingle();
  if (!card) notFound();
  const [{ data: member }, { data: tpl }, { data: history }, brand] = await Promise.all([
    supabase.from("members").select("*").eq("id", card.member_id).eq("organization_id", org.id).maybeSingle(),
    card.template_id ? supabase.from("card_templates").select(TEMPLATE_COLUMNS).eq("id", card.template_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("card_status_history").select("old_status, new_status, created_at").eq("card_id", card.id).order("created_at", { ascending: false }).limit(20),
    loadBranding(org.id),
  ]);
  if (!member) notFound();
  const template = tpl as unknown as TemplateRow | null;
  const photo = member.photo_processed_path ? ((await signedPhotoUrls([member.photo_processed_path])).get(member.photo_processed_path) ?? null) : null;
  const values = {
    ...memberCardValues(member as Record<string, unknown>, brand),
    card_number: card.card_number,
    issue_date: card.issue_date,
    expiry_date: card.expiry_date,
  };
  const isAdmin = hasRole(role, "org_admin");
  const live = card.status === "active" || card.status === "suspended";
  const act = (s: "active" | "suspended" | "revoked" | "lost") => changeCardStatus.bind(null, card.id, s);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/app/cards" className="text-sm text-slate-600 underline">
          ← Cards
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{member.full_name}</h1>
        <p className="font-mono text-sm text-slate-600">
          {card.card_number} · <span className="capitalize">{card.status}</span>
          {card.expiry_date ? ` · expires ${card.expiry_date}` : ""}
        </p>
        <Link href={`/app/members/${member.id}`} className="text-sm underline">
          View member
        </Link>
      </div>

      {template && isAdmin && live ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">QR code</h2>
          <IssuePanel
            action={regenerateQr.bind(null, card.id)}
            label="New QR code"
            warning="Shows the card with a fresh QR code. The previous QR code stops working immediately."
            template={template}
            values={values}
            photoUrl={photo}
            brand={brand}
          />
        </section>
      ) : null}

      {template ? (
        <div className="grid gap-4 md:grid-cols-2">
          {(["front", "back"] as const).map((side) => (
            <div key={side} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium capitalize text-slate-700">{side}</p>
              <div className="flex justify-center rounded-lg bg-slate-100 p-4">
                <CardSide
                  design={side === "front" ? template.front_design : template.back_design}
                  widthMm={Number(template.width_mm)}
                  heightMm={Number(template.height_mm)}
                  data={{ values, photoUrl: photo }}
                  brand={brand}
                  uid={`c-${side}`}
                  className={template.orientation === "portrait" ? "h-72 w-auto drop-shadow-md" : "w-full max-w-[420px] drop-shadow-md"}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-600">The template for this card is no longer available.</p>
      )}

      {isAdmin && live ? (
        <div className="flex flex-wrap gap-2">
          {card.status === "active" ? (
            <form action={act("suspended")}>
              <button className={secondaryButtonClass}>Suspend</button>
            </form>
          ) : (
            <form action={act("active")}>
              <button className={secondaryButtonClass}>Reactivate</button>
            </form>
          )}
          <form action={act("lost")}>
            <button className={secondaryButtonClass}>Mark lost</button>
          </form>
          <form action={act("revoked")}>
            <button className={secondaryButtonClass + " border-red-300 text-red-800"}>Revoke</button>
          </form>
        </div>
      ) : null}
      {isAdmin && live ? <p className="text-xs text-slate-500">Suspending, losing or revoking a card takes effect immediately when its QR code is scanned.</p> : null}

      {history && history.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 font-semibold">History</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {history.map((h, i) => (
              <li key={i}>
                <span className="capitalize">{h.old_status ?? "new"}</span> → <span className="font-medium capitalize">{h.new_status}</span>{" "}
                <span className="text-slate-500">· {new Date(h.created_at).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
