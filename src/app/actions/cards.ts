"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrg, hasRole } from "@/lib/auth";
import { generateCredentialToken, hashCredential, verifyUrl } from "@/lib/credentials";
import { qrModules } from "@/lib/qr";
import { createActiveCard } from "@/lib/cards-core";

export type IssueState = { error?: string; qr?: boolean[][]; cardId?: string; cardNumber?: string } | null;

const uuid = z.uuid();

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

  const made = await createActiveCard(supabase, {
    orgId: org.id,
    memberId,
    templateId: settings.default_template_id,
    validityMonths: settings.card_validity_months,
    userId: user.id,
    replaces: live,
  });
  if (!made.ok) return { error: made.error + " Please try again." };
  const card = { id: made.cardId, card_number: made.cardNumber };
  const token = made.token;

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
