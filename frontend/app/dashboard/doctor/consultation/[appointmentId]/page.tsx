import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";
import ConsultationForm from "@/components/dental/ConsultationForm";
import type {
  Consultation,
  ConsultationService,
  DentalService,
  PatientPrecheck,
} from "@/types/app";

type ConsultationPageProps = {
  params: Promise<{
    appointmentId: string;
  }>;
  searchParams: Promise<{
    message?: string;
    error?: string;
  }>;
};

function shortTime(time: string) {
  return time.slice(0, 5);
}

async function getLinkedDoctorId(profileId: string, email: string | null) {
  const supabase = await createClient();

  const { data: linkedDoctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("user_id", profileId)
    .maybeSingle();

  if (linkedDoctor?.id) {
    return linkedDoctor.id as string;
  }

  if (!email) {
    return null;
  }

  const { data: emailDoctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  return (emailDoctor?.id as string) ?? null;
}

export default async function ConsultationPage({
  params,
  searchParams,
}: ConsultationPageProps) {
  const profile = await requireRole(["doctor", "admin", "admin_doctor"]);

  const { appointmentId } = await params;
  const query = await searchParams;

  const supabase = await createClient();

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select(
      "*, doctors(*), patient:profiles!appointments_patient_id_fkey(full_name, phone, email, age, sex, address), patient_prechecks(*)"
    )
    .eq("id", appointmentId)
    .single();

  if (appointmentError || !appointment) {
    notFound();
  }

  if (profile.role === "doctor") {
    const linkedDoctorId = await getLinkedDoctorId(profile.id, profile.email);

    if (!linkedDoctorId || linkedDoctorId !== appointment.doctor_id) {
      redirect(
        `/dashboard/doctor?error=${encodeURIComponent(
          "You are not allowed to open this consultation"
        )}`
      );
    }
  }

  const { data: servicesData } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  const services = (servicesData ?? []) as DentalService[];

  const { data: consultationData } = await supabase
    .from("consultations")
    .select("*, consultation_services(*)")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  const existingConsultation = consultationData
    ? ({
        id: consultationData.id,
        appointment_id: consultationData.appointment_id,
        patient_id: consultationData.patient_id,
        doctor_id: consultationData.doctor_id,
        diagnosis: consultationData.diagnosis,
        treatment_plan: consultationData.treatment_plan,
        doctor_notes: consultationData.doctor_notes,
        total_amount: consultationData.total_amount,
        created_at: consultationData.created_at,
        updated_at: consultationData.updated_at,
      } as Consultation)
    : null;

  const existingItems = consultationData
    ? ((consultationData.consultation_services ?? []) as ConsultationService[])
    : [];

  const precheck = appointment.patient_prechecks?.[0] as
    | PatientPrecheck
    | undefined;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <Link
          href="/dashboard/doctor"
          className="text-sm font-semibold text-teal-700"
        >
          ← Back to Doctor Dashboard
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Doctor Consultation
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Select teeth, add services, write diagnosis, and save treatment
              plan.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
  <div className="rounded-xl bg-slate-100 px-4 py-3">
    <p className="text-xs font-semibold uppercase text-slate-500">
      Appointment Status
    </p>
    <p className="mt-1 text-sm font-bold capitalize text-slate-900">
      {appointment.status.replace("_", " ")}
    </p>
  </div>

  {existingConsultation && (
    <Link
      href={`/dashboard/doctor/agreement/${existingConsultation.id}`}
      className="rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white hover:bg-teal-700"
    >
      Create Agreement
    </Link>
  )}
  {existingConsultation && (
  <Link
    href={`/dashboard/doctor/invoice/${existingConsultation.id}`}
    className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-700"
  >
    Create Invoice
  </Link>
)}
</div>
        </div>

        {query?.message && (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {query.message}
          </div>
        )}

        {query?.error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {query.error}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Patient Details
          </h2>

          <div className="mt-5 space-y-4 text-sm">
            <div>
              <p className="text-slate-500">Name</p>
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
              <p className="text-slate-500">Address</p>
              <p className="font-semibold text-slate-900">
                {appointment.patient?.address ?? "-"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Appointment Details
          </h2>

          <div className="mt-5 space-y-4 text-sm">
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
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Compounder Pre-Check
          </h2>

          {!precheck ? (
  <div className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
    <p className="font-semibold">Pre-check is still pending.</p>

    <p className="mt-1">
      Doctor can complete the pre-check now by asking the patient directly.
    </p>

    <Link
      href={`/dashboard/compounder/precheck/${appointment.id}?return_to=/dashboard/doctor/consultation/${appointment.id}`}
      className="mt-3 inline-block rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white"
    >
      Fill Pre-Check Now
    </Link>
    <Link
  href={`/dashboard/compounder/precheck/${appointment.id}?return_to=/dashboard/doctor/consultation/${appointment.id}`}
  className="mt-3 inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
>
  Update Pre-Check
</Link>
  </div>
) : (
            <div className="mt-5 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-500">BP</p>
                  <p className="font-semibold text-slate-900">
                    {precheck.blood_pressure ?? "-"}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Pulse</p>
                  <p className="font-semibold text-slate-900">
                    {precheck.pulse ?? "-"}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Temperature</p>
                  <p className="font-semibold text-slate-900">
                    {precheck.temperature ?? "-"}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Weight</p>
                  <p className="font-semibold text-slate-900">
                    {precheck.weight ?? "-"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-slate-500">Pain Level</p>
                <p className="font-semibold text-slate-900">
                  {precheck.pain_level ?? "-"}
                </p>
              </div>

              {precheck.allergy && (
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="font-semibold text-amber-700">
                    Allergy: {precheck.allergy}
                  </p>
                </div>
              )}

              {(precheck.diabetes ||
                precheck.heart_disease ||
                precheck.pregnancy_status) && (
                <div className="rounded-lg bg-red-50 p-3 text-red-700">
                  {precheck.diabetes && <p>Diabetes</p>}
                  {precheck.heart_disease && <p>Heart disease</p>}
                  {precheck.pregnancy_status && (
                    <p>Pregnancy: {precheck.pregnancy_status}</p>
                  )}
                </div>
              )}

              {precheck.medical_warning && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
                  <p className="font-bold">Medical Warning</p>
                  <p className="mt-1">{precheck.medical_warning}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConsultationForm
        appointmentId={appointment.id}
        services={services}
        existingConsultation={existingConsultation}
        existingItems={existingItems}
      />
    </div>
  );
}