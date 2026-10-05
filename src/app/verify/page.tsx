import type { Metadata } from "next";
import { Scanner } from "./_components/scanner";

export const metadata: Metadata = {
  title: "Check an ID · EduCard Pro",
  robots: { index: false, follow: false },
};

export default function VerifyIndex() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Check an ID</h1>
        <p className="mt-1 text-sm text-slate-600">Scan the QR code on the card, or paste the link or code.</p>
      </div>
      <Scanner />
      <p className="text-center text-xs text-slate-500">You can also scan the QR code with your phone&apos;s normal camera app.</p>
    </main>
  );
}
