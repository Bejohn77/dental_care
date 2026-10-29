import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";
import { updateAppointmentStatusAction } from "@/app/dashboard/appointments/actions";

type DoctorDashboardPageProps = {
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

export default async function DoctorDashboardPage({
  searchParams,
}: DoctorDashboardPageProps) {
  const profile = await requireRole(["doctor", "admin", "admin_doctor"]);

  const params = await searchParams;
  const supabase = await createClient();
  const today = todayInDhaka();

  let doctorRecord = null;

  const { data: linkedDoctor } = await supabase
    .from("doctors")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();

  doctorRecord = linkedDoctor;

  if (!doctorRecord && profile.email) {
    const { data: emailDoctor } = await supabase
      .from("doctors")
      .select("*")
      .eq("email", profile.email)
      .maybeSingle();

    doctorRecord = emailDoctor;
  }

  if (!doctorRecord) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Doctor Dashboard</h1>

        <p className="mt-3 text-slate-600">
          Your login account is not linked with any doctor profile yet.
        </p>

        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Go to <strong>Admin → Doctors</strong>, create or update a doctor
          using this email: <strong>{profile.email}</strong>. Then save the
          doctor profile once. The system will link the account automatically.
        </div>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("appointments")
    .select(
      "*, patient:profiles!appointments_patient_id_fkey(full_name, phone, email, age, sex), patient_prechecks(*), consultations(id, total_amount, agreements(id, patient_signature, signed_at), invoices(id, total_amount, paid_amount, due_amount, status))",
    )
    .eq("doctor_id", doctorRecord.id)
    .eq("appointment_date", today)
    .order("start_time", { ascending: true });

  const appointments = data ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Doctor Dashboard</h1>

        <p className="mt-2 text-slate-600">
          Welcome, {profile.full_name}. You are viewing appointments for{" "}
          <strong>{doctorRecord.name}</strong>.
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

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Today’s Appointments</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {appointments.length}
          </p>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Checked In</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {
              appointments.filter(
                (appointment: any) => appointment.status === "checked_in",
              ).length
            }
          </p>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">In Consultation</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {
              appointments.filter(
                (appointment: any) => appointment.status === "in_consultation",
              ).length
            }
          </p>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Completed</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {
              appointments.filter(
                (appointment: any) => appointment.status === "completed",
              ).length
            }
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">
          Today’s Appointments — {today}
        </h2>

        <div className="mt-5 overflow-x-auto rounded-xl border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Patient</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Pre-Check</th>
                <th className="p-3">Consultation</th>
                <th className="p-3">Agreement</th>
                <th className="p-3">Invoice</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>

            <tbody>
              {appointments.length === 0 && (
                <tr>
                  <td className="p-4 text-slate-600" colSpan={9}>
                    No appointment found for today.
                  </td>
                </tr>
              )}

              {appointments.map((appointment: any) => {
                const precheck = appointment.patient_prechecks?.[0];
                const consultation = appointment.consultations?.[0];
                const agreement = consultation?.agreements?.[0];
                const invoice = consultation?.invoices?.[0];

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

                    <td className="p-3">{appointment.reason ?? "-"}</td>

                    <td className="p-3">
                      {precheck ? (
                        <div className="space-y-2 text-xs">
                          <span className="inline-block rounded-full bg-green-100 px-3 py-1 font-semibold text-green-700">
                            Done
                          </span>

                          <p className="text-slate-600">
                            BP: {precheck.blood_pressure ?? "-"}
                          </p>

                          <p className="text-slate-600">
                            Pain: {precheck.pain_level ?? "-"}
                          </p>

                          {precheck.medical_warning && (
                            <p className="font-semibold text-red-600">
                              Warning added
                            </p>
                          )}

                          <Link
                            href={`/dashboard/compounder/precheck/${appointment.id}?return_to=/dashboard/doctor`}
                            className="inline-block rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Update Pre-Check
                          </Link>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                            Pending
                          </span>

                          <Link
                            href={`/dashboard/compounder/precheck/${appointment.id}?return_to=/dashboard/doctor`}
                            className="block rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Fill Pre-Check
                          </Link>
                        </div>
                      )}
                    </td>

                    <td className="p-3">
                      {consultation ? (
                        <div>
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                            Saved
                          </span>
                          <p className="mt-2 text-xs font-semibold text-slate-700">
                            ৳
                            {Number(consultation.total_amount).toLocaleString(
                              "en-BD",
                            )}
                          </p>
                        </div>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                          Not started
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {consultation ? (
                        agreement?.patient_signature ? (
                          <div className="space-y-2">
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                              Signed
                            </span>

                            <Link
                              href={`/dashboard/doctor/agreement/${consultation.id}`}
                              className="block rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              View Agreement
                            </Link>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                              Pending
                            </span>

                            <Link
                              href={`/dashboard/doctor/agreement/${consultation.id}`}
                              className="block rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              Create Agreement
                            </Link>
                          </div>
                        )
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          Not ready
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {consultation ? (
                        invoice ? (
                          <div className="space-y-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                                invoice.status === "paid"
                                  ? "bg-green-100 text-green-700"
                                  : invoice.status === "partial"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {invoice.status}
                            </span>

                            <p className="text-xs text-slate-600">
                              Due: ৳
                              {Number(invoice.due_amount).toLocaleString(
                                "en-BD",
                              )}
                            </p>

                            <Link
                              href={`/dashboard/doctor/invoice/${consultation.id}`}
                              className="block rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              View Invoice
                            </Link>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                              Pending
                            </span>

                            <Link
                              href={`/dashboard/doctor/invoice/${consultation.id}`}
                              className="block rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              Create Invoice
                            </Link>
                          </div>
                        )
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          Not ready
                        </span>
                      )}
                    </td>

                    <td className="p-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                        {appointment.status.replace("_", " ")}
                      </span>
                    </td>

                    <td className="p-3">
                      <div className="space-y-2">
                        <Link
                          href={`/dashboard/doctor/consultation/${appointment.id}`}
                          className="inline-block rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Open Consultation
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
                            value="completed"
                          />
                          <input
                            type="hidden"
                            name="return_to"
                            value="/dashboard/doctor"
                          />

                          <button
                            type="submit"
                            className="block rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Mark Completed
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
