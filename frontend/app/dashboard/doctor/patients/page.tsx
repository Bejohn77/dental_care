import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";

export const dynamic = "force-dynamic";

type DoctorPatientsPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

function cleanSearch(value: string) {
  return value.trim().toLowerCase();
}

function getPatientFromRelation(value: any) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function getLinkedDoctorId(profileId: string, email: string | null) {
  const supabase = await createClient();

  const { data: linkedDoctor } = await supabase
    .from("doctors")
    .select("id, name")
    .eq("user_id", profileId)
    .maybeSingle();

  if (linkedDoctor?.id) {
    return linkedDoctor;
  }

  if (!email) {
    return null;
  }

  const { data: emailDoctor } = await supabase
    .from("doctors")
    .select("id, name")
    .eq("email", email)
    .maybeSingle();

  return emailDoctor ?? null;
}

export default async function DoctorPatientsPage({
  searchParams,
}: DoctorPatientsPageProps) {
  const profile = await requireRole(["doctor", "admin", "admin_doctor"]);

  const params = await searchParams;
  const q = cleanSearch(params?.q ?? "");

  const supabase = await createClient();

  if (profile.role === "admin" || profile.role === "admin_doctor") {
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

    const patients = (data ?? []).map((patient: any) => ({
      id: patient.id,
      full_name: patient.full_name,
      email: patient.email,
      phone: patient.phone,
      age: patient.age,
      sex: patient.sex,
      address: patient.address,
      last_appointment_date: "-",
    }));

    return (
      <PatientsListView
        title="All Patients"
        subtitle="As an admin doctor, you can view all patient records."
        patients={patients}
        error={error?.message}
        q={q}
      />
    );
  }

  const doctorRecord = await getLinkedDoctorId(profile.id, profile.email);

  if (!doctorRecord) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">My Patients</h1>

        <p className="mt-3 text-slate-600">
          Your login account is not linked with any doctor profile yet.
        </p>

        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Go to <strong>Admin → Doctors</strong>, create or update a doctor
          using this email: <strong>{profile.email}</strong>. Then save the
          doctor profile once.
        </div>
      </div>
    );
  }

  const { data: appointmentRows, error } = await supabase
    .from("appointments")
    .select(
      "appointment_date, patient:profiles!appointments_patient_id_fkey(id, full_name, email, phone, age, sex, address)"
    )
    .eq("doctor_id", doctorRecord.id)
    .order("appointment_date", { ascending: false })
    .limit(500);

  const patientMap = new Map<string, any>();

  for (const row of appointmentRows ?? []) {
    const patient = getPatientFromRelation((row as any).patient);

    if (!patient?.id) continue;

    const searchableText = `${patient.full_name ?? ""} ${
      patient.email ?? ""
    } ${patient.phone ?? ""}`.toLowerCase();

    if (q && !searchableText.includes(q)) continue;

    if (!patientMap.has(patient.id)) {
      patientMap.set(patient.id, {
        id: patient.id,
        full_name: patient.full_name,
        email: patient.email,
        phone: patient.phone,
        age: patient.age,
        sex: patient.sex,
        address: patient.address,
        last_appointment_date: (row as any).appointment_date,
      });
    }
  }

  const patients = Array.from(patientMap.values());

  return (
    <PatientsListView
      title="My Patients"
      subtitle={`Patients who have appointments with ${doctorRecord.name}.`}
      patients={patients}
      error={error?.message}
      q={q}
    />
  );
}

function PatientsListView({
  title,
  subtitle,
  patients,
  error,
  q,
}: {
  title: string;
  subtitle: string;
  patients: any[];
  error?: string;
  q: string;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>

            <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
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
              <a
                href="/dashboard/doctor/patients"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear
              </a>
            )}
          </form>
        </div>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
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
                <th className="p-3">Last Appointment</th>
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

              {patients.map((patient) => {
                const patientId = String(patient.id ?? "");
                const historyUrl = `/dashboard/patient-history?patientId=${encodeURIComponent(
                  patientId
                )}`;

                return (
                  <tr key={patientId} className="border-t">
                    <td className="p-3">
                      <p className="font-semibold text-slate-900">
                        {patient.full_name ?? "Unknown"}
                      </p>

                      <p className="text-xs text-slate-500">
                        {patient.address ?? "-"}
                      </p>
                    </td>

                    <td className="p-3">{patient.phone ?? "-"}</td>

                    <td className="p-3">{patient.email ?? "-"}</td>

                    <td className="p-3">
                      {patient.age ?? "-"} / {patient.sex ?? "-"}
                    </td>

                    <td className="p-3">
                      {patient.last_appointment_date ?? "-"}
                    </td>

                    <td className="p-3">
                      {patientId ? (
                        <a
                          href={historyUrl}
                          className="inline-block rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                        >
                          Open History
                        </a>
                      ) : (
                        <span className="text-xs font-semibold text-red-600">
                          Missing patient ID
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Showing available patient records based on your access.
        </p>
      </div>
    </div>
  );
}