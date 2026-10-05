import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateCredentialToken, hashCredential } from "@/lib/credentials";

function addMonths(d: Date, months: number): string {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + months);
  return x.toISOString().slice(0, 10);
}

/**
 * Create an active card plus its credential (hash only). Caller must already have verified the
 * user is an admin of `orgId`. If the credential cannot be stored the card is revoked, so an active
 * card never exists without one.
 */
export async function createActiveCard(
  supabase: SupabaseClient,
  p: {
    orgId: string;
    memberId: string;
    templateId: string;
    validityMonths: number;
    userId: string;
    batchId?: string | null;
    replaces?: { id: string; replacement_number: number } | null;
  },
): Promise<{ ok: true; cardId: string; cardNumber: string; token: string } | { ok: false; error: string }> {
  const { data: number, error: nErr } = await supabase.rpc("next_card_number", { p_org: p.orgId });
  if (nErr || !number) return { ok: false, error: "Could not allocate a card number." };
  const today = new Date();
  const { data: card, error } = await supabase
    .from("id_cards")
    .insert({
      organization_id: p.orgId,
      member_id: p.memberId,
      template_id: p.templateId,
      batch_id: p.batchId ?? null,
      card_number: number as string,
      status: "active",
      issue_date: today.toISOString().slice(0, 10),
      expiry_date: addMonths(today, p.validityMonths),
      replacement_number: p.replaces ? p.replaces.replacement_number + 1 : 1,
      replaces_card_id: p.replaces?.id ?? null,
      created_by: p.userId,
    })
    .select("id, card_number")
    .single();
  if (error || !card) return { ok: false, error: "Could not create the card." };
  const token = generateCredentialToken();
  const { error: cErr } = await supabase
    .from("verification_credentials")
    .insert({ organization_id: p.orgId, card_id: card.id, credential_hash: hashCredential(token) });
  if (cErr) {
    await supabase.from("id_cards").update({ status: "revoked" }).eq("id", card.id);
    return { ok: false, error: "Could not create the QR credential." };
  }
  if (p.replaces) await supabase.from("id_cards").update({ status: "replaced" }).eq("id", p.replaces.id);
  return { ok: true, cardId: card.id, cardNumber: card.card_number, token };
}
