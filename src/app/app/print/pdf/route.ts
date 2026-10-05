import { NextResponse } from "next/server";
import * as z from "zod";
import { requireOrg, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateCredentialToken, hashCredential, verifyUrl } from "@/lib/credentials";
import { qrModules } from "@/lib/qr";
import { PROCESSED_BUCKET } from "@/lib/photos";
import { loadBranding, memberCardValues, TEMPLATE_COLUMNS } from "@/lib/templates/data";
import type { TemplateRow } from "@/lib/templates/schema";
import { buildPdf, type PrintCard } from "@/lib/print/pdf";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_CARDS = 50;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });

const form = z.object({
  layout: z.enum(["card", "a4"]).default("card"),
  marks: z.string().optional(),
  confirm: z.literal("on", { error: "Please tick the box to confirm." }),
  batch: z.uuid().optional(),
  part: z.coerce.number().int().min(1).max(100).default(1),
});

/**
 * Print = issue fresh QR codes and render them into a PDF. Only hashes are stored, so earlier printed
 * copies of these cards stop working. The PDF is built first; QR codes are rotated only if it succeeds.
 */
export async function POST(req: Request) {
  // Same-origin only (cookies are SameSite=Lax, this is a second layer).
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  let originHost: string | null = null;
  try { originHost = origin ? new URL(origin).host : null; } catch { originHost = null; }
  if (!originHost || !host || originHost !== host) return fail("Bad request.", 403);

  const { org, role } = await requireOrg();
  if (!hasRole(role, "org_admin")) return fail("Only admins can print cards.", 403);

  // Rate limit: printing is expensive and rotates QR codes, so cap it per organization.
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count: recentPrints } = await createAdminClient()
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("action", "cards.printed")
    .gte("created_at", since);
  if ((recentPrints ?? 0) >= 20) return fail("Too many print runs in the last few minutes. Please wait and try again.", 429);

  const fd = await req.formData();
  const parsed = form.safeParse({
    layout: fd.get("layout") ?? undefined,
    marks: fd.get("marks") ?? undefined,
    confirm: fd.get("confirm") ?? undefined,
    batch: fd.get("batch") || undefined,
    part: fd.get("part") || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid request.");
  const ids = fd.getAll("card").filter((x): x is string => typeof x === "string" && z.uuid().safeParse(x).success);
  if (!parsed.data.batch && ids.length === 0) return fail("Choose a card or a batch to print.");

  const supabase = await createClient();
  let q = supabase
    .from("id_cards")
    .select("id, card_number, member_id, template_id, issue_date, expiry_date, status")
    .eq("organization_id", org.id)
    .in("status", ["active", "suspended"])
    .order("card_number");
  if (parsed.data.batch) {
    const from = (parsed.data.part - 1) * MAX_CARDS;
    q = q.eq("batch_id", parsed.data.batch).range(from, from + MAX_CARDS - 1);
  } else q = q.in("id", ids.slice(0, MAX_CARDS));
  const { data: cards } = await q;
  if (!cards?.length) return fail("There are no printable cards here. Only active or suspended cards can be printed.");

  const brand = await loadBranding(org.id);
  const [{ data: members }, { data: templates }, { data: o }] = await Promise.all([
    supabase.from("members").select("*").eq("organization_id", org.id).in("id", [...new Set(cards.map((c) => c.member_id))]),
    supabase.from("card_templates").select(TEMPLATE_COLUMNS).in("id", [...new Set(cards.map((c) => c.template_id).filter((x): x is string => !!x))]),
    supabase.from("organizations").select("logo_path").eq("id", org.id).maybeSingle(),
  ]);
  const memberById = new Map((members ?? []).map((m) => [m.id, m]));
  const templateById = new Map(((templates ?? []) as unknown as TemplateRow[]).map((t) => [t.id, t]));

  // All cards on one sheet must share a size.
  const first = templateById.get(cards[0].template_id ?? "");
  if (!first) return fail("A card's template is no longer available.");
  const printCards: PrintCard[] = [];
  const tokens = new Map<string, string>();
  for (let i = 0; i < cards.length; i += 8) {
    await Promise.all(
      cards.slice(i, i + 8).map(async (c) => {
        const t = templateById.get(c.template_id ?? "");
        const m = memberById.get(c.member_id);
        if (!t || !m) return;
        if (Number(t.width_mm) !== Number(first.width_mm) || Number(t.height_mm) !== Number(first.height_mm)) return;
        const token = generateCredentialToken();
        tokens.set(c.id, token);
        let photo: Uint8Array | null = null;
        if (m.photo_processed_path) {
          const dl = await supabase.storage.from(PROCESSED_BUCKET).download(m.photo_processed_path);
          if (dl.data) photo = new Uint8Array(await dl.data.arrayBuffer());
        }
        printCards.push({
          key: c.id,
          widthMm: Number(t.width_mm),
          heightMm: Number(t.height_mm),
          frontDesign: t.front_design,
          backDesign: t.back_design,
          values: { ...memberCardValues(m as Record<string, unknown>, brand), card_number: c.card_number, issue_date: c.issue_date, expiry_date: c.expiry_date },
          photo,
          qr: qrModules(verifyUrl(token)),
        });
      }),
    );
  }
  if (printCards.length === 0) return fail("Nothing could be printed. Cards on one sheet must use templates of the same size.");
  printCards.sort((a, b) => (a.key < b.key ? -1 : 1));
  const skipped = cards.length - printCards.length;

  let logo: Uint8Array | null = null;
  if (o?.logo_path) {
    const dl = await supabase.storage.from("org-assets").download(o.logo_path);
    if (dl.data) logo = new Uint8Array(await dl.data.arrayBuffer());
  }

  let pdf: Uint8Array;
  try {
    pdf = await buildPdf(printCards, { layout: parsed.data.layout, marks: parsed.data.marks === "on", brand, logo });
  } catch {
    return fail("Could not build the PDF. Nothing was changed.", 500);
  }

  // Commit the new QR codes only now that the PDF exists. Narrow service-role write after the admin check above.
  const admin = createAdminClient();
  for (const c of printCards) {
    const { error } = await admin.from("verification_credentials").update({ credential_hash: hashCredential(tokens.get(c.key)!) }).eq("card_id", c.key).eq("organization_id", org.id);
    if (error) return fail("Could not secure the QR codes. Please try again.", 500);
  }
  await admin.from("audit_logs").insert({ organization_id: org.id, action: "cards.printed", entity_type: "id_cards", metadata: { count: printCards.length, layout: parsed.data.layout, batch: parsed.data.batch ?? null } });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="educard-${printCards.length}-cards.pdf"`,
      "cache-control": "no-store",
      "x-printed": String(printCards.length),
      "x-skipped": String(skipped),
    },
  });
}
