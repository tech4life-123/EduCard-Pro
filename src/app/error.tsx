"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-slate-600">We could not complete that. Nothing was lost. Please try again, and if it keeps happening contact your administrator.</p>
      <div className="flex gap-3">
        <button type="button" onClick={reset} className="rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white">Try again</button>
        <Link href="/app" className="rounded-lg border border-slate-300 px-4 py-2.5 font-medium">Dashboard</Link>
      </div>
    </main>
  );
}
