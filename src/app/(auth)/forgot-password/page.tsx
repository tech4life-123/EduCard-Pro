import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Reset password · EduCard Pro" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Reset your password</h1>
        <p className="text-sm text-slate-600">We will email you a link to choose a new one.</p>
      </div>
      <ForgotForm />
      <p className="text-center text-sm">
        <Link href="/login" className="text-slate-600 underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
