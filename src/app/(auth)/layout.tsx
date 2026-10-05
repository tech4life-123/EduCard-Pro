import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <Link href="/" className="text-center text-2xl font-bold tracking-tight">
        EduCard Pro
      </Link>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">{children}</div>
    </main>
  );
}
