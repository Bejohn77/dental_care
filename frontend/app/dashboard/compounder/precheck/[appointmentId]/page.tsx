import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";
import type { PatientPrecheck } from "@/types/app";
import { savePrecheckAction } from "./actions";

type PrecheckPageProps = {
  params: Promise<{
    appointmentId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    return_to?: string;
  }>;
};
function shortTime(time: string) {
  return time.slice(0, 5);
}

export default async function PrecheckPage({
  params,
  searchParams,
}: PrecheckPageProps) {
  const profile = await requireRole([
  "compounder",
  "doctor",
  "admin",
  "admin_doctor",
]);

  const { appointmentId } = await params;
  const query = await searchParams;
  const defaultReturnTo =
  profile.role === "doctor" ? "/dashboard/doctor" : "/dashboard/compounder";

const returnTo =
  query?.return_to && query.return_to.startsWith("/dashboard")
    ? query.return_to
    : defaultReturnTo;

  const supabase = await createClient();

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select(
      "*, doctors(name, speciality), patient:profiles!appointments_patient_id_fkey(full_name, phone, email, age, sex, address)"
    )
    .eq("id", appointmentId)
    .single();

  if (appointmentError || !appointment) {
    notFound();
  }

  const { data: precheckData } = await supabase
    .from("patient_prechecks")
    .select("*")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  const precheck = precheckData as PatientPrecheck | null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <Link
  href={returnTo}
  className="text-sm font-semibold text-teal-700"
>
  ← Back
</Link>

        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          Patient Pre-Check
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Fill the basic clinical information before the doctor starts
          consultation.
        </p>

        {query?.error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {query.error}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Appointment Details
          </h2>

          <div className="mt-5 space-y-4 text-sm">
            <div>
              <p className="text-slate-500">Patient</p>
              <p className="font-semibold text-slate-900">
                {appointment.patient?.full_name ?? "Unknown"}
              </p>
            </div>

            <div>
              <p className="text-slate-500">Phone</p>
              <p className="font-semibold text-slate-900">
                {appointment.patient?.phone ?? "-"}
              </p>
            </div>

            <div>
              <p className="text-slate-500">Age / Sex</p>
              <p className="font-semibold text-slate-900">
                {appointment.patient?.age ?? "-"} /{" "}
                {appointment.patient?.sex ?? "-"}
              </p>
            </div>

            <div>
              <p className="text-slate-500">Doctor</p>
              <p className="font-semibold text-slate-900">
                {appointment.doctors?.name ?? "Unknown"}
              </p>
              <p className="text-xs text-slate-500">
                {appointment.doctors?.speciality ?? "Dental Surgeon"}
              </p>
            </div>

            <div>
              <p className="text-slate-500">Date & Time</p>
              <p className="font-semibold text-slate-900">
                {appointment.appointment_date}, {shortTime(appointment.start_time)}{" "}
                - {shortTime(appointment.end_time)}
              </p>
            </div>

            <div>
              <p className="text-slate-500">Reason</p>
              <p className="font-semibold text-slate-900">
                {appointment.reason ?? "-"}
              </p>
            </div>

            <div>
              <p className="text-slate-500">Current Status</p>
              <p className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                {appointment.status.replace("_", " ")}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Clinical Pre-Check Form
          </h2>

          <form action={savePrecheckAction} className="mt-5 grid gap-4 md:grid-cols-2">
            <input
              type="hidden"
              name="appointment_id"
              value={appointment.id}
            />

            <input
              type="hidden"
              name="patient_id"
              value={appointment.patient_id}
            />
            <input type="hidden" name="return_to" value={returnTo} />

            <div>
              <label className="text-sm font-medium text-slate-700">
                Blood Pressure
              </label>
              <input
                name="blood_pressure"
                defaultValue={precheck?.blood_pressure ?? ""}
                placeholder="120/80"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Pulse
              </label>
              <input
                name="pulse"
                defaultValue={precheck?.pulse ?? ""}
                placeholder="78 bpm"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Temperature
              </label>
              <input
                name="temperature"
                defaultValue={precheck?.temperature ?? ""}
                placeholder="98.6°F"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Weight
              </label>
              <input
                name="weight"
                defaultValue={precheck?.weight ?? ""}
                placeholder="65 kg"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Pain Level
              </label>
              <select
                name="pain_level"
                defaultValue={precheck?.pain_level ?? ""}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
              >
                <option value="">Select pain level</option>
                <option value="0">0 - No pain</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5 - Moderate</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10">10 - Severe</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Pregnancy Status
              </label>
              <select
                name="pregnancy_status"
                defaultValue={precheck?.pregnancy_status ?? ""}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
              >
                <option value="">Not applicable / Unknown</option>
                <option value="not_pregnant">Not pregnant</option>
                <option value="pregnant">Pregnant</option>
                <option value="possibly_pregnant">Possibly pregnant</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Allergy Information
              </label>
              <textarea
                name="allergy"
                rows={3}
                defaultValue={precheck?.allergy ?? ""}
                placeholder="Example: Allergic to penicillin, anaesthesia, pain killer..."
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
              />
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                name="diabetes"
                type="checkbox"
                defaultChecked={precheck?.diabetes ?? false}
                className="h-4 w-4"
              />
              Patient has diabetes
            </label>

            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                name="heart_disease"
                type="checkbox"
                defaultChecked={precheck?.heart_disease ?? false}
                className="h-4 w-4"
              />
              Patient has heart disease
            </label>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Current Medication
              </label>
              <textarea
                name="current_medication"
                rows={3}
                defaultValue={precheck?.current_medication ?? ""}
                placeholder="Example: Blood pressure medicine, diabetes medicine, blood thinner..."
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Medical Warning Note
              </label>
              <textarea
                name="medical_warning"
                rows={3}
                defaultValue={precheck?.medical_warning ?? ""}
                placeholder="Important warning for doctor"
                className="mt-1 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-red-600"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                General Notes
              </label>
              <textarea
                name="notes"
                rows={3}
                defaultValue={precheck?.notes ?? ""}
                placeholder="Any other information"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-teal-600 px-5 py-2.5 font-semibold text-white hover:bg-teal-700"
              >
                Save Pre-Check
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}