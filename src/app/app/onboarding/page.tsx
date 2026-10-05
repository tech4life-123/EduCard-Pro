import { redirect } from "next/navigation";
import { getMemberships, requireUser } from "@/lib/auth";
import { OrgForm } from "./org-form";

export const metadata = { title: "Set up your organization · EduCard Pro" };

export default async function OnboardingPage() {
  await requireUser();
  // Already in an organization? Go to the dashboard (extra organizations can be added later).
  if ((await getMemberships()).length > 0) redirect("/app");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h1 className="text-xl font-semibold">Set up your organization</h1>
        <p className="mb-5 mt-1 text-sm text-slate-600">
          Everything you create — members, cards, templates — belongs to this organization and is kept private to it.
        </p>
        <OrgForm />
      </div>
    </main>
  );
}
