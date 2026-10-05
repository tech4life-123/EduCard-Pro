"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extractToken } from "@/lib/token-input";

type Detector = { detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

export function Scanner() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;

  function go(raw: string) {
    const t = extractToken(raw);
    if (!t) {
      setError("That does not look like an EduCard Pro code. Scan the QR on the card or paste its link.");
      return false;
    }
    router.push(`/verify/${t}`);
    return true;
  }

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const el = video.current;
        if (!el) return;
        el.srcObject = stream;
        await el.play();
        const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
        const detector = new Ctor({ formats: ["qr_code"] });
        const tick = async () => {
          if (stopped) return;
          try {
            const found = await detector.detect(el);
            if (found[0] && go(found[0].rawValue)) return;
          } catch {}
          setTimeout(tick, 250);
        };
        void tick();
      } catch {
        setError("Camera not available. Allow camera access, or paste the link below.");
        setActive(false);
      }
    })();
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
      {supported ? (
        active ? (
          <div className="space-y-2">
            <video ref={video} playsInline muted className="aspect-square w-full rounded-xl bg-black object-cover" />
            <button type="button" onClick={() => setActive(false)} className="min-h-11 w-full rounded-lg border border-slate-300 font-medium">
              Stop camera
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => { setError(null); setActive(true); }} className="min-h-11 w-full rounded-lg bg-slate-900 font-medium text-white">
            Scan QR code
          </button>
        )
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          go(text);
        }}
        className="space-y-2"
      >
        <label htmlFor="code" className="block text-sm font-medium text-slate-700">
          Or paste the link or code
        </label>
        <input id="code" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base" placeholder="https://…/verify/…" />
        <button type="submit" className="min-h-11 w-full rounded-lg border border-slate-300 font-medium">
          Check
        </button>
      </form>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
