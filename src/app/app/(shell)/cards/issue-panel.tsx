"use client";

import { useActionState } from "react";
import { CardSide } from "@/components/card-svg";
import { buttonClass } from "@/components/form";
import type { IssueState } from "@/app/actions/cards";
import type { Branding, TemplateRow } from "@/lib/templates/schema";

type Action = (prev: IssueState, formData: FormData) => Promise<IssueState>;

/** Runs an issue/regenerate action and shows the card with its real QR code, once. */
export function IssuePanel({
  action,
  label,
  warning,
  template,
  values,
  photoUrl,
  brand,
}: {
  action: Action;
  label: string;
  warning?: string;
  template: TemplateRow;
  values: Record<string, string | null | undefined>;
  photoUrl: string | null;
  brand: Branding;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const size = { widthMm: Number(template.width_mm), heightMm: Number(template.height_mm) };
  const cls = template.orientation === "portrait" ? "h-64 w-auto drop-shadow" : "w-full max-w-[340px] drop-shadow";
  const issued = state?.qr ? new Date() : null;
  return (
    <div className="space-y-3">
      {!state?.qr ? (
        <form action={formAction} className="space-y-2">
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Working…" : label}
          </button>
          {warning ? <p className="text-xs text-slate-500">{warning}</p> : null}
        </form>
      ) : null}
      {state?.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state?.qr ? (
        <div className="space-y-3">
          <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Card {state.cardNumber} is active. This is the only time the real QR code is shown. Printing comes in a later step; if you leave this page,
            use &ldquo;New QR code&rdquo; on the card page to show it again (the old QR stops working).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["front", "back"] as const).map((side) => (
              <div key={side} className="flex justify-center rounded-lg bg-slate-100 p-3">
                <CardSide
                  design={side === "front" ? template.front_design : template.back_design}
                  {...size}
                  data={{ values: { ...values, card_number: state.cardNumber, issue_date: issued?.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) }, photoUrl, qrModules: state.qr }}
                  brand={brand}
                  uid={`issued-${side}`}
                  className={cls}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
