"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrg, hasRole } from "@/lib/auth";
import { generateCredentialToken, hashCredential, verifyUrl } from "@/lib/credentials";
import { qrModules } from "@/lib/qr";

export type IssueState = { error?: string; qr?: boolean[][]; cardId?: string; cardNumber?: string } | null;

const uuid = z.uuid();

function addMonths(d: Date, months: number): string {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + months);
  return x.toISOString().slice(0, 10);
}

/**
 * Issue an ID card for a member. Admin only (staff can prepare members and photos, admins activate).
 * If the member already has a live card, it is marked replaced and the new card links to it.
 * The plaintext QR token exists only in this request: the database keeps its hash.
 */
export async function issueCard(memberId: string, _prev: IssueState, _formData: FormData): Promise<IssueState> {
  const { org, role, user } = await requireOrg();
  if (!hasRole(role, "org_admin")) return { error: "Only admins can issue cards." };
  if (!uuid.safeParse(memberId).success) return { error: "That member could not be found." };
  const supabase = await createClient();

  const [{ data: member }, { data: settings }] = await Promise.all([
    supabase.from("members").select("id, status").eq("id", memberId).eq("organization_id", org.id).maybeSingle(),
    supabase.from("organization_settings").select("default_template_id, card_validity_months").eq("organization_id", org.id).maybeSingle(),
  ]);
  if (!member) return { error: "That member could not be found." };
  if (member.status !== "active") return { error: "Only active members can be issued a card." };
  if (!settings?.default_template_id) return { error: "Choose a default template first (Templates page)." };

  const { data: live } = await supabase
    .from("id_cards")
    .select("id, replacement_number")
    .eq("member_id", memberId)
    .eq("organization_id", org.id)
    .in("status", ["active", "suspended"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: number, error: nErr } = await supabase.rpc("next_card_number", { p_org: org.id });
  if (nErr || !number) return { error: "Could not allocate a card number. Please try again." };

  const today = new Date();
  const { data: card, error } = await supabase
    .from("id_cards")
    .insert({
      organization_id: org.id,
      member_id: memberId,
      template_id: settings.default_template_id,
      card_number: number as string,
      status: "active",
      issue_date: today.toISOString().slice(0, 10),
      expiry_date: addMonths(today, settings.card_validity_months),
      replacement_number: live ? live.replacement_number + 1 : 1,
      replaces_card_id: live?.id ?? null,
      created_by: user.id,
    })
    .select("id, card_number")
    .single();
  if (error || !card) return { error: "Could not issue the card. Please try again." };

  const token = generateCredentialToken();
  const { error: cErr } = await supabase
    .from("verification_credentials")
    .insert({ organization_id: org.id, card_id: card.id, credential_hash: hashCredential(token) });
  if (cErr) {
    // Never leave an active card without a credential.
    await supabase.from("id_cards").update({ status: "revoked" }).eq("id", card.id);
    return { error: "Could not create the QR credential. Please try again." };
  }

  if (live) await supabase.from("id_cards").update({ status: "replaced" }).eq("id", live.id);

  revalidatePath("/app/cards");
  revalidatePath(`/app/members/${memberId}`);
  revalidatePath("/app");
  return { qr: qrModules(verifyUrl(token)), cardId: card.id, cardNumber: card.card_number };
}

/** New QR for an existing card (e.g. reprint or leaked card). The old QR stops working immediately. */
export async function regenerateQr(cardId: string, _prev: IssueState, _formData: FormData): Promise<IssueState> {
  const { org, role } = await requireOrg();
  if (!hasRole(role, "org_admin")) return { error: "Only admins can regenerate a QR code." };
  if (!uuid.safeParse(cardId).success) return { error: "That card could not be found." };
  const supabase = await createClient();
  const { data: card } = await supabase
    .from("id_cards")
    .select("id, card_number, status")
    .eq("id", cardId)
    .eq("organization_id", org.id)
    .maybeSingle();
  if (!card) return { error: "That card could not be found." };
  if (card.status !== "active" && card.status !== "suspended") return { error: "Only live cards can get a new QR code." };

  const token = generateCredentialToken();
  // Credentials have no update policy for users, so this narrow write uses the service role
  // only after the role and organization checks above.
  const { error } = await createAdminClient()
    .from("verification_credentials")
    .update({ credential_hash: hashCredential(token) })
    .eq("card_id", card.id)
    .eq("organization_id", org.id);
  if (error) return { error: "Could not regenerate the QR code. Please try again." };
  revalidatePath(`/app/cards/${card.id}`);
  return { qr: qrModules(verifyUrl(token)), cardId: card.id, cardNumber: card.card_number };
}

const TRANSITIONS: Record<string, string[]> = {
  active: ["suspended", "revoked", "lost"],
  suspended: ["active", "revoked", "lost"],
};

export async function changeCardStatus(cardId: string, next: "active" | "suspended" | "revoked" | "lost"): Promise<void> {
  const { org, role } = await requireOrg();
  if (!hasRole(role, "org_admin") || !uuid.safeParse(cardId).success) return;
  const supabase = await createClient();
  const { data: card } = await supabase.from("id_cards").select("id, status").eq("id", cardId).eq("organization_id", org.id).maybeSingle();
  if (!card || !TRANSITIONS[card.status]?.includes(next)) return;
  await supabase.from("id_cards").update({ status: next }).eq("id", card.id).eq("organization_id", org.id);
  revalidatePath("/app/cards");
  revalidatePath(`/app/cards/${card.id}`);
  redirect(`/app/cards/${card.id}`);
}
