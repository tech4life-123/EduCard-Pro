import type { Metadata } from "next";
import { verifyToken, type VerifyResult } from "@/lib/verify";

// Verification pages must never be indexed or cached as a shared page.
export const metadata: Metadata = {
  title: "ID Verification · EduCard Pro",
  robots: { index: false, follow: false },
};

const VIEW: Record<
  VerifyResult,
  { icon: string; title: string; tone: string; message: string }
> = {
  VERIFIED: {
    icon: "✓",
    title: "ID VERIFIED",
    tone: "bg-emerald-50 text-emerald-900 border-emerald-300",
    message: "This ID was issued through EduCard Pro.",
  },
  EXPIRED: {
    icon: "⚠",
    title: "ID EXPIRED",
    tone: "bg-amber-50 text-amber-900 border-amber-300",
    message: "This ID is no longer valid. Ask the holder for a current ID.",
  },
  REVOKED: {
    icon: "⚠",
    title: "ID REVOKED",
    tone: "bg-red-50 text-red-900 border-red-300",
    message: "This ID has been cancelled by the issuing organization. Do not accept it.",
  },
  SUSPENDED: {
    icon: "⚠",
    title: "ID SUSPENDED",
    tone: "bg-amber-50 text-amber-900 border-amber-300",
    message: "This ID is temporarily suspended. Contact the issuing organization.",
  },
  REPLACED: {
    icon: "⚠",
    title: "ID REPLACED",
    tone: "bg-amber-50 text-amber-900 border-amber-300",
    message: "A newer ID has been issued to this member. This one is no longer valid.",
  },
  INVALID: {
    icon: "✕",
    title: "ID NOT RECOGNIZED",
    tone: "bg-red-50 text-red-900 border-red-300",
    message: "This code is not a valid EduCard Pro ID. Do not rely on it.",
  },
  RATE_LIMITED: {
    icon: "⏳",
    title: "TOO MANY CHECKS",
    tone: "bg-slate-50 text-slate-900 border-slate-300",
    message: "Please wait a minute and scan again.",
  },
  UNAVAILABLE: {
    icon: "!",
    title: "CHECK UNAVAILABLE",
    tone: "bg-slate-50 text-slate-900 border-slate-300",
    message: "We couldn't complete the check right now. Please try again shortly.",
  },
};

const FIELD_LABELS: Record<string, string> = {
  full_name: "Name",
  role_title: "Role",
  department: "Department",
  class_name: "Class",
  grade_level: "Grade",
  academic_year: "Academic year",
};

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ credential: string }>;
}) {
  const { credential } = await params;
  const outcome = await verifyToken(credential);
  const view = VIEW[outcome.result] ?? VIEW.INVALID;
  const showDetails = ["VERIFIED", "EXPIRED", "REVOKED", "SUSPENDED", "REPLACED"].includes(
    outcome.result,
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
      <section
        role="status"
        aria-live="polite"
        className={`rounded-2xl border-2 p-6 text-center ${view.tone}`}
      >
        <div className="text-5xl" aria-hidden="true">
          {view.icon}
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-wide">{view.title}</h1>
        <p className="mt-2 text-sm">{view.message}</p>
      </section>

      {showDetails && (
        <dl className="rounded-2xl border bg-white p-4 text-sm shadow-sm">
          {outcome.organization && (
            <div className="py-2">
              <dt className="text-slate-500">Organization</dt>
              <dd className="font-semibold">{outcome.organization}</dd>
            </div>
          )}
          {outcome.card_number && (
            <div className="border-t py-2">
              <dt className="text-slate-500">Card ID</dt>
              <dd className="font-mono font-semibold">{outcome.card_number}</dd>
            </div>
          )}
          {outcome.issued && (
            <div className="border-t py-2">
              <dt className="text-slate-500">Issued</dt>
              <dd className="font-semibold">{outcome.issued}</dd>
            </div>
          )}
          {outcome.public_fields &&
            Object.entries(outcome.public_fields).map(([k, v]) => (
              <div key={k} className="border-t py-2">
                <dt className="text-slate-500">{FIELD_LABELS[k] ?? k}</dt>
                <dd className="font-semibold">{String(v)}</dd>
              </div>
            ))}
          {outcome.wording && <p className="border-t pt-2 text-slate-600">{outcome.wording}</p>}
        </dl>
      )}

      <p className="text-center text-xs text-slate-500">
        A valid result confirms the card is on record and in good standing. Always compare the photo
        and name on the card with the person presenting it.
      </p>
    </main>
  );
}
