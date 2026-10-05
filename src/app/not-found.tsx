import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-slate-600">That page does not exist, or you do not have access to it.</p>
      <div className="flex gap-3">
        <Link href="/app" className="rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white">Dashboard</Link>
        <Link href="/verify" className="rounded-lg border border-slate-300 px-4 py-2.5 font-medium">Verify an ID</Link>
      </div>
    </main>
  );
}
