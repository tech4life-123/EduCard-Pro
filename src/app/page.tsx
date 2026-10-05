import Link from "next/link";
import { getUser } from "@/lib/auth";
import { buttonClass, secondaryButtonClass } from "@/components/form";

export default async function Home() {
  const user = await getUser();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-5 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">EduCard Pro</h1>
        <p className="text-slate-600">Professional ID Card Creation &amp; Verification Platform</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {user ? (
          <Link href="/app" className={buttonClass}>
            Open dashboard
          </Link>
        ) : (
          <>
            <Link href="/login" className={buttonClass}>
              Sign in
            </Link>
            <Link href="/signup" className={secondaryButtonClass}>
              Create account
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
