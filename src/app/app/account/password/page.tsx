import { requireUser } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Choose a new password · EduCard Pro" };

export default async function PasswordPage() {
  await requireUser();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h1 className="mb-4 text-xl font-semibold">Choose a new password</h1>
        <PasswordForm />
      </div>
    </main>
  );
}
