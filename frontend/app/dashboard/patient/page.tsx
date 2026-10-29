import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";

type AdminPatientsPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

function cleanSearch(value: string) {
  return value.trim().replace(/,/g, " ");
}

export default async function AdminPatientsPage({
  searchParams,
}: AdminPatientsPageProps) {
  await requireRole(["admin", "admin_doctor"]);

  const params = await searchParams;
  const q = cleanSearch(params?.q ?? "");

  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, phone, age, sex, address, created_at")
    .eq("role", "patient")
    .order("created_at", { ascending: false })
    .limit(100);

  if (q) {
    query = query.or(
      `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
    );
  }

  const { data, error } = await query;

  const patients = data ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Patient Records
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Search patient profiles and open full clinical, agreement,
              invoice, and payment history.
            </p>
          </div>

          <form className="flex flex-wrap gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search name, phone, email"
              className="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-600"
            />

            <button
              type="submit"
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Search
            </button>

            {q && (
              <Link
                href="/dashboard/admin/patients"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear
              </Link>
            )}
          </form>
        </div>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Patients</h2>

        <div className="mt-5 overflow-x-auto rounded-xl border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">Patient</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Email</th>
                <th className="p-3">Age/Sex</th>
                <th className="p-3">Address</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>

            <tbody>
              {patients.length === 0 && (
                <tr>
                  <td className="p-4 text-slate-600" colSpan={6}>
                    No patient found.
                  </td>
                </tr>
              )}

              {patients.map((patient: any) => (
                <tr key={patient.id} className="border-t">
                  <td className="p-3">
                    <p className="font-semibold text-slate-900">
                      {patient.full_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      Created:{" "}
                      {patient.created_at
                        ? new Date(patient.created_at).toLocaleDateString()
                        : "-"}
                    </p>
                  </td>

                  <td className="p-3">{patient.phone ?? "-"}</td>

                  <td className="p-3">{patient.email ?? "-"}</td>

                  <td className="p-3">
                    {patient.age ?? "-"} / {patient.sex ?? "-"}
                  </td>

                  <td className="p-3">{patient.address ?? "-"}</td>

                  <td className="p-3">
                    <Link
                      href={`/dashboard/patient-history?patientId=${patient.id}`}
                      className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                    >
                      Open History
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Showing latest 100 patients. Use search for specific records.
        </p>
      </div>
    </div>
  );
}