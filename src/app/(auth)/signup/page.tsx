import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account · EduCard Pro" };

export default function SignupPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="text-sm text-slate-600">You will set up your organization next.</p>
      </div>
      <SignupForm />
      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-slate-900 underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
