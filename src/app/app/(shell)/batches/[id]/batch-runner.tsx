"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { processBatch } from "@/app/actions/batches";
import { buttonClass } from "@/components/form";

export function BatchRunner({ batchId, step, label, pending, disabled }: { batchId: string; step: "members" | "cards"; label: string; pending: number; disabled?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    let total = 0;
    try {
      for (let i = 0; i < 200; i++) {
        const r = await processBatch(batchId, step);
        if (r.error) {
          setError(r.error);
          break;
        }
        total += r.processed;
        setDone(total);
        if (r.remaining === 0) break;
        if (r.processed === 0 && r.remaining > 0) {
          setError("Some rows could not be processed. See the list below.");
          break;
        }
      }
    } catch {
      setError("Connection problem. Press the button again to continue where it stopped.");
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={run} disabled={busy || pending === 0 || !!disabled} className={buttonClass + " w-full sm:w-auto"}>
        {busy ? `Working… ${done} done` : `${label} (${pending})`}
      </button>
      {disabled ? <p className="text-xs text-slate-500">{disabled}</p> : null}
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
