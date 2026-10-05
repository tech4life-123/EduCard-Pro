import Link from "next/link";
import { requireOrg } from "@/lib/auth";
import { NewBatchForm } from "./new-batch-form";

export const metadata = { title: "New batch · EduCard Pro" };

export default async function NewBatchPage() {
  await requireOrg();
  return (
    <div className="max-w-xl space-y-5">
      <div>
        <Link href="/app/batches" className="text-sm text-slate-600 underline">
          ← Batches
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">New batch</h1>
        <p className="text-sm text-slate-600">Upload a CSV of people. We check every row before anything is added.</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <p className="font-medium">Your file needs:</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            A header row with <code>first_name</code> and <code>last_name</code> (required). Optional: <code>date_of_birth</code>, <code>gender</code>, <code>class_name</code>, <code>section</code>,{" "}
            <code>grade_level</code>, <code>academic_year</code>, <code>student_number</code>, <code>employee_number</code>, <code>role_title</code>, <code>department</code>, <code>phone</code>,{" "}
            <code>address</code>, and your custom field keys.
          </li>
          <li>Dates as 2012-03-25 or 25/03/2012 (day first). Up to 500 rows, 1 MB.</li>
          <li>Excel users: File → Save As → CSV.</li>
        </ul>
        <a href="/app/batches/template.csv" className="mt-3 inline-block font-medium underline">
          Download a sample file
        </a>
      </div>
      <NewBatchForm />
    </div>
  );
}
