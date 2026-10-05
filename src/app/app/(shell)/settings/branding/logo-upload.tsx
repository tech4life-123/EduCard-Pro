"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { recordLogo } from "@/app/actions/branding";
import { secondaryButtonClass } from "@/components/form";

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export function LogoUpload({ orgId, currentUrl }: { orgId: string; currentUrl: string | null }) {
  const [url, setUrl] = useState(currentUrl);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    const ext = TYPES[file.type];
    if (!ext) return setMsg({ ok: false, text: "Use a PNG, JPG or WebP image." });
    if (file.size > 2 * 1024 * 1024) return setMsg({ ok: false, text: "The logo must be under 2 MB." });
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const path = `${orgId}/logo/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("org-assets").upload(path, file, { contentType: file.type });
    if (up.error) {
      setBusy(false);
      return setMsg({ ok: false, text: "Upload failed. Try again." });
    }
    const r = await recordLogo(path);
    if (r?.error) {
      setBusy(false);
      return setMsg({ ok: false, text: r.error });
    }
    const signed = await supabase.storage.from("org-assets").createSignedUrl(path, 60 * 30);
    setUrl(signed.data?.signedUrl ?? null);
    setBusy(false);
    setMsg({ ok: true, text: "Logo saved." });
  }

  async function remove() {
    setBusy(true);
    const r = await recordLogo(null);
    setBusy(false);
    if (r?.error) return setMsg({ ok: false, text: r.error });
    setUrl(null);
    setMsg({ ok: true, text: "Logo removed." });
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">Logo</h2>
      <div className="flex items-center gap-4">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Organization logo" className="size-20 rounded-lg border border-slate-200 object-contain" />
        ) : (
          <div className="flex size-20 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500">No logo</div>
        )}
        <div className="flex flex-wrap gap-2">
          <label className={secondaryButtonClass + " cursor-pointer"}>
            {busy ? "Working…" : url ? "Replace logo" : "Upload logo"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {url ? (
            <button type="button" onClick={remove} disabled={busy} className={secondaryButtonClass}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
      {msg ? (
        <p role={msg.ok ? "status" : "alert"} className={"rounded-lg px-3 py-2 text-sm " + (msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800")}>
          {msg.text}
        </p>
      ) : null}
    </section>
  );
}
