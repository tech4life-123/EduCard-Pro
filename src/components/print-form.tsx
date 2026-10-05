"use client";

import { useState } from "react";
import { buttonClass } from "@/components/form";

/** Posts to the print route and downloads the PDF. Printing issues fresh QR codes, so a confirmation is required. */
export function PrintForm({ cardId, batchId, parts = 1 }: { cardId?: string; batchId?: string; parts?: number }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (cardId) fd.set("card", cardId);
    if (batchId) fd.set("batch", batchId);
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/app/print/pdf", { method: "POST", body: fd });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setMsg({ ok: false, text: j?.error ?? "Could not create the PDF." });
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "cards.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        const skipped = Number(res.headers.get("x-skipped") ?? 0);
        setMsg({ ok: true, text: `PDF ready (${res.headers.get("x-printed")} card${res.headers.get("x-printed") === "1" ? "" : "s"})${skipped ? `, ${skipped} skipped because their template size differs` : ""}. Print it at 100% / actual size.` });
      }
    } catch {
      setMsg({ ok: false, text: "Connection problem. Nothing was changed. Try again." });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {batchId && parts > 1 ? (
        <div>
          <label htmlFor="part" className="block text-sm font-medium text-slate-700">
            Part (50 cards each)
          </label>
          <select id="part" name="part" className="block rounded-lg border border-slate-300 bg-white px-3 py-2.5">
            {Array.from({ length: parts }, (_, i) => (
              <option key={i} value={i + 1}>
                Part {i + 1}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div>
        <label htmlFor="layout" className="block text-sm font-medium text-slate-700">
          Layout
        </label>
        <select id="layout" name="layout" defaultValue="card" className="block rounded-lg border border-slate-300 bg-white px-3 py-2.5">
          <option value="card">ID card printer (one card per page, front then back)</option>
          <option value="a4">A4 sheets (several cards per page, for cutting)</option>
        </select>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="marks" className="size-5" /> Crop marks (A4 sheets)
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm" required className="mt-0.5 size-5 shrink-0" />
        <span>I understand printing creates new QR codes: any earlier printed copy of these cards will stop scanning as valid.</span>
      </label>
      <button type="submit" disabled={busy} className={buttonClass}>
        {busy ? "Creating PDF…" : "Create print PDF"}
      </button>
      {msg ? (
        <p role={msg.ok ? "status" : "alert"} className={"rounded-lg px-3 py-2 text-sm " + (msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800")}>
          {msg.text}
        </p>
      ) : null}
    </form>
  );
}
