import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";
import { updateAppointmentStatusAction } from "@/app/dashboard/appointments/actions";

type AdminAppointmentsPageProps = {
  searchParams: Promise<{
    message?: string;
    error?: string;
  }>;
};

const statuses = [
  "pending",
  "confirmed",
  "checked_in",
  "in_consultation",
  "completed",
  "cancelled",
];

function shortTime(time: string) {
  return time.slice(0, 5);
}

export default async function AdminAppointmentsPage({
  searchParams,
}: AdminAppointmentsPageProps) {
  await requireRole(["admin", "admin_doctor"]);

  const params = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("appointments")
    .select(
  "*, doctors(name, speciality), patient:profiles!appointments_patient_id_fkey(full_name, phone, email, age, sex)"
)
    .order("appointment_date", { ascending: false })
    .order("start_time", { ascending: false });

  const appointments = data ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          All Appointments
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Admin can view all appointments and update appointment status.
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
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Time</th>
                <th className="p-3">Patient</th>
                <th className="p-3">Doctor</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>

            <tbody>
              {appointments.length === 0 && (
                <tr>
                  <td className="p-4 text-slate-600" colSpan={6}>
                    No appointment found.
                  </td>
                </tr>
              )}

              {appointments.map((appointment: any) => (
                <tr key={appointment.id} className="border-t align-top">
                  <td className="p-3">{appointment.appointment_date}</td>
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
                    <form action={updateAppointmentStatusAction}>
                      <input
                        type="hidden"
                        name="appointment_id"
                        value={appointment.id}
                      />
                      <input
                        type="hidden"
                        name="return_to"
                        value="/dashboard/admin/appointments"
                      />

                      <select
                        name="status"
                        defaultValue={appointment.status}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-900"
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status.replace("_", " ")}
                          </option>
                        ))}
                      </select>

                      <button
                        type="submit"
                        className="mt-2 block rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Update
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}