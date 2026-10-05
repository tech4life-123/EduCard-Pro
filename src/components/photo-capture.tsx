"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { recordPhoto, removePhoto } from "@/app/actions/photos";
import { buttonClass, secondaryButtonClass } from "@/components/form";

// Crop frame (CSS px) and output size. 3:4 portrait is the standard ID-photo shape.
const FW = 300;
const FH = 400;
const OUT_W = 600;
const OUT_H = 800;
const MAX_ORIGINAL = 1600;
const MIN_SOURCE = 400;

type Crop = { zoom: number; ox: number; oy: number };

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality),
  );
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(file);
  }
}

/** Keep the image covering the whole frame so there are never empty edges. */
function clamp(bmp: ImageBitmap, c: Crop): Crop {
  const scale = Math.max(FW / bmp.width, FH / bmp.height) * c.zoom;
  const maxX = Math.max(0, (bmp.width * scale - FW) / 2);
  const maxY = Math.max(0, (bmp.height * scale - FH) / 2);
  return { zoom: c.zoom, ox: Math.min(maxX, Math.max(-maxX, c.ox)), oy: Math.min(maxY, Math.max(-maxY, c.oy)) };
}

function paint(ctx: CanvasRenderingContext2D, bmp: ImageBitmap, c: Crop, factor: number) {
  const scale = Math.max(FW / bmp.width, FH / bmp.height) * c.zoom * factor;
  const w = bmp.width * scale;
  const h = bmp.height * scale;
  ctx.drawImage(bmp, (FW * factor) / 2 + c.ox * factor - w / 2, (FH * factor) / 2 + c.oy * factor - h / 2, w, h);
}

export function PhotoCapture({
  orgId,
  memberId,
  currentUrl,
  name,
}: {
  orgId: string;
  memberId: string;
  currentUrl: string | null;
  name: string;
}) {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [crop, setCrop] = useState<Crop>({ zoom: 1, ox: 0, oy: 0 });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "error" | "ok" | "warn"; text: string } | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(currentUrl);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // Draw the live crop preview, with an oval guide for centering the face.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bitmap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, FW, FH);
    paint(ctx, bitmap, crop, 1);
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
    ctx.beginPath();
    ctx.rect(0, 0, FW, FH);
    ctx.ellipse(FW / 2, FH * 0.45, FW * 0.3, FH * 0.34, 0, 0, Math.PI * 2);
    ctx.fill("evenodd");
    ctx.restore();
  }, [bitmap, crop]);

  const onFile = useCallback(async (file: File | undefined) => {
    setStatus(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus({ kind: "error", text: "Please choose an image file." });
      return;
    }
    try {
      const bmp = await decode(file);
      setBitmap(bmp);
      setCrop({ zoom: 1, ox: 0, oy: 0 });
      if (Math.min(bmp.width, bmp.height) < MIN_SOURCE) {
        setStatus({ kind: "warn", text: "This photo is small and may look blurry on the card. A closer, sharper photo is better." });
      }
    } catch {
      setStatus({ kind: "error", text: "That image could not be opened. Try a JPEG or PNG." });
    }
  }, []);

  function pointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  }
  function pointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drag.current || !bitmap) return;
    // The canvas may be displayed smaller than FW, so convert screen pixels to frame pixels.
    const ratio = FW / e.currentTarget.getBoundingClientRect().width;
    const dx = (e.clientX - drag.current.x) * ratio;
    const dy = (e.clientY - drag.current.y) * ratio;
    drag.current = { x: e.clientX, y: e.clientY };
    setCrop((c) => clamp(bitmap, { ...c, ox: c.ox + dx, oy: c.oy + dy }));
  }
  function pointerUp() {
    drag.current = null;
  }

  async function save() {
    if (!bitmap) return;
    setBusy(true);
    setStatus(null);
    try {
      // Final cropped portrait for the card.
      const out = document.createElement("canvas");
      out.width = OUT_W;
      out.height = OUT_H;
      const octx = out.getContext("2d");
      if (!octx) throw new Error("no canvas");
      octx.fillStyle = "#ffffff";
      octx.fillRect(0, 0, OUT_W, OUT_H);
      paint(octx, bitmap, crop, OUT_W / FW);
      const processed = await toBlob(out, 0.9);

      // Downscaled original, kept so the crop can be redone later.
      const ratio = Math.min(1, MAX_ORIGINAL / Math.max(bitmap.width, bitmap.height));
      const orig = document.createElement("canvas");
      orig.width = Math.round(bitmap.width * ratio);
      orig.height = Math.round(bitmap.height * ratio);
      orig.getContext("2d")!.drawImage(bitmap, 0, 0, orig.width, orig.height);
      const original = await toBlob(orig, 0.85);

      const supabase = createClient();
      const path = `${orgId}/${memberId}/${crypto.randomUUID()}.jpg`;
      const up1 = await supabase.storage.from("member-photos-processed").upload(path, processed, { contentType: "image/jpeg" });
      if (up1.error) throw new Error("upload");
      const up2 = await supabase.storage.from("member-photos-original").upload(path, original, { contentType: "image/jpeg" });
      if (up2.error) throw new Error("upload");

      const result = await recordPhoto(memberId, path, path);
      if (result?.error) throw new Error(result.error);

      const signed = await supabase.storage.from("member-photos-processed").createSignedUrl(path, 60 * 30);
      setPhotoUrl(signed.data?.signedUrl ?? null);
      setBitmap(null);
      setStatus({ kind: "ok", text: "Photo saved." });
    } catch (e) {
      const text = e instanceof Error && e.message !== "upload" ? e.message : "Upload failed. Check your connection and try again.";
      setStatus({ kind: "error", text });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    const result = await removePhoto(memberId);
    setBusy(false);
    if (result?.error) return setStatus({ kind: "error", text: result.error });
    setPhotoUrl(null);
    setStatus({ kind: "ok", text: "Photo removed." });
  }

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">Photo</h2>

      {bitmap ? (
        <div className="space-y-3">
          <canvas
            ref={canvasRef}
            width={FW}
            height={FH}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
            className="mx-auto block w-full max-w-[300px] touch-none cursor-grab rounded-lg bg-slate-200"
            aria-label="Drag to position the face inside the oval"
          />
          <div className="mx-auto max-w-[300px]">
            <label htmlFor="zoom" className="text-sm text-slate-700">
              Zoom
            </label>
            <input
              id="zoom"
              type="range"
              min={1}
              max={4}
              step={0.02}
              value={crop.zoom}
              onChange={(e) => setCrop((c) => clamp(bitmap, { ...c, zoom: Number(e.target.value) }))}
              className="w-full"
            />
            <p className="text-xs text-slate-500">Drag to move. Keep the face centered in the oval, eyes level, shoulders visible.</p>
          </div>
          <div className="mx-auto flex max-w-[300px] gap-2">
            <button type="button" onClick={save} disabled={busy} className={buttonClass + " flex-1"}>
              {busy ? "Saving…" : "Save photo"}
            </button>
            <button type="button" onClick={() => setBitmap(null)} disabled={busy} className={secondaryButtonClass}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={`Photo of ${name}`} width={120} height={160} className="h-40 w-30 rounded-lg border border-slate-200 object-cover" />
          ) : (
            <div className="flex h-40 w-30 items-center justify-center rounded-lg bg-slate-100 text-3xl font-semibold text-slate-500" aria-hidden>
              {initials || "?"}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <label className={buttonClass + " cursor-pointer"}>
              Take photo
              <input type="file" accept="image/*" capture="user" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <label className={secondaryButtonClass + " cursor-pointer"}>
              Choose from gallery
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {photoUrl ? (
              <button type="button" onClick={remove} disabled={busy} className={secondaryButtonClass}>
                Remove
              </button>
            ) : null}
          </div>
        </div>
      )}

      {status ? (
        <p
          role={status.kind === "error" ? "alert" : "status"}
          className={
            "rounded-lg px-3 py-2 text-sm " +
            (status.kind === "error" ? "bg-red-50 text-red-800" : status.kind === "warn" ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800")
          }
        >
          {status.text}
        </p>
      ) : null}
    </section>
  );
}
