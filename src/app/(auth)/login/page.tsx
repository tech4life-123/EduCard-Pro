import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · EduCard Pro" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const linkError = sp.error === "link";
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-slate-600">Welcome back.</p>
      </div>
      {linkError ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
          That link is invalid or has expired. Sign in, or request a new link.
        </p>
      ) : null}
      <LoginForm next={next} />
      <p className="text-center text-sm text-slate-600">
        New here?{" "}
        <Link href="/signup" className="font-medium text-slate-900 underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
