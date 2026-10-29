import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";
import { updateAppointmentStatusAction } from "@/app/dashboard/appointments/actions";

type CompounderDashboardPageProps = {
  searchParams: Promise<{
    message?: string;
    error?: string;
  }>;
};

function todayInDhaka() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
  }).format(new Date());
}

function shortTime(time: string) {
  return time.slice(0, 5);
}

export default async function CompounderDashboardPage({
  searchParams,
}: CompounderDashboardPageProps) {
  const profile = await requireRole(["compounder", "admin", "admin_doctor"]);

  const params = await searchParams;
  const supabase = await createClient();
  const today = todayInDhaka();

  const { data, error } = await supabase
    .from("appointments")
    .select(
      "*, doctors(name, speciality), patient:profiles!appointments_patient_id_fkey(full_name, phone, email, age, sex), patient_prechecks(id, blood_pressure, pain_level, medical_warning)"
    )
    .eq("appointment_date", today)
    .order("start_time", { ascending: true });

  const appointments = data ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          Compounder Dashboard
        </h1>

        <p className="mt-2 text-slate-600">
          Welcome, {profile.full_name}. Open each patient appointment and fill
          the pre-check information before doctor consultation.
        </p>

        {params?.message && (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {params.message}
          </div>
        )}

        {params?.error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {params.error}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">
          Today’s Patients — {today}
        </h2>

        <div className="mt-5 overflow-x-auto rounded-xl border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Patient</th>
                <th className="p-3">Doctor</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Pre-Check</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>

            <tbody>
              {appointments.length === 0 && (
                <tr>
                  <td className="p-4 text-slate-600" colSpan={7}>
                    No appointment found for today.
                  </td>
                </tr>
              )}

              {appointments.map((appointment: any) => {
                const precheck = appointment.patient_prechecks?.[0];

                return (
                  <tr key={appointment.id} className="border-t align-top">
                    <td className="p-3">
                      {shortTime(appointment.start_time)} -{" "}
                      {shortTime(appointment.end_time)}
                    </td>

                    <td className="p-3">
                      <p className="font-semibold text-slate-900">
                        {appointment.patient?.full_name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {appointment.patient?.phone ?? "-"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {appointment.patient?.age ?? "-"} /{" "}
                        {appointment.patient?.sex ?? "-"}
                      </p>
                    </td>

                    <td className="p-3">
                      <p className="font-semibold text-slate-900">
                        {appointment.doctors?.name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {appointment.doctors?.speciality ?? "Dental Surgeon"}
                      </p>
                    </td>

                    <td className="p-3">{appointment.reason ?? "-"}</td>

                    <td className="p-3">
                      {precheck ? (
                        <div>
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                            Done
                          </span>
                          <p className="mt-2 text-xs text-slate-500">
                            BP: {precheck.blood_pressure ?? "-"}
                          </p>
                          <p className="text-xs text-slate-500">
                            Pain: {precheck.pain_level ?? "-"}
                          </p>
                          {precheck.medical_warning && (
                            <p className="mt-1 text-xs font-semibold text-red-600">
                              Warning added
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                          Pending
                        </span>
                      )}
                    </td>

                    <td className="p-3">
                      <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                        {appointment.status.replace("_", " ")}
                      </p>
                    </td>

                    <td className="p-3">
                      <div className="space-y-2">
                        <Link
                          href={`/dashboard/compounder/precheck/${appointment.id}`}
                          className="inline-block rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Open Pre-Check
                        </Link>

                        <form action={updateAppointmentStatusAction}>
                          <input
                            type="hidden"
                            name="appointment_id"
                            value={appointment.id}
                          />
                          <input
                            type="hidden"
                            name="status"
                            value="cancelled"
                          />
                          <input
                            type="hidden"
                            name="return_to"
                            value="/dashboard/compounder"
                          />

                          <button
                            type="submit"
                            className="block rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            Cancel
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}