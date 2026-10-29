import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";
import PatientSignaturePad from "@/components/dental/PatientSignaturePad";
import {
  createOrUpdateAgreementAction,
} from "./actions";

type AgreementPageProps = {
  params: Promise<{
    consultationId: string;
  }>;
  searchParams: Promise<{
    message?: string;
    error?: string;
  }>;
};

function buildAgreementText(data: {
  patientName: string;
  doctorName: string;
  diagnosis: string;
  treatmentPlan: string;
  totalAmount: number;
}) {
  return `
Treatment Consent Agreement

I, ${data.patientName}, have consulted with ${data.doctorName} at Medico Dental Care.

The doctor has explained my dental condition, diagnosis, proposed treatment, possible benefits, risks, limitations, alternatives, and estimated treatment cost.

Diagnosis:
${data.diagnosis || "As explained by the doctor."}

Treatment Plan:
${data.treatmentPlan || "As advised by the doctor."}

Estimated Total Amount:
BDT ${data.totalAmount}

I understand that dental treatment may involve pain, swelling, bleeding, sensitivity, infection, treatment failure, need for further treatment, change in treatment plan, or other possible complications.

I also understand that the final cost may change depending on clinical findings, additional procedures, materials, laboratory work, or follow-up treatment.

I voluntarily give consent to Medico Dental Care and the treating doctor to perform the above-mentioned dental treatment.
`.trim();
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

export default async function AgreementPage({
  params,
  searchParams,
}: AgreementPageProps) {
  const profile = await requireRole(["doctor", "admin", "admin_doctor"]);

  const { consultationId } = await params;
  const query = await searchParams;

  const supabase = await createClient();

  const { data: consultation, error: consultationError } = await supabase
    .from("consultations")
    .select(
      "*, doctors(*), patient:profiles!consultations_patient_id_fkey(full_name, phone, email, age, sex, address), consultation_services(*)"
    )
    .eq("id", consultationId)
    .single();

  if (consultationError || !consultation) {
    notFound();
  }

  if (profile.role === "doctor") {
    const linkedDoctorId = await getLinkedDoctorId(profile.id, profile.email);

    if (!linkedDoctorId || linkedDoctorId !== consultation.doctor_id) {
      redirect(
        `/dashboard/doctor?error=${encodeURIComponent(
          "You are not allowed to open this agreement"
        )}`
      );
    }
  }

  const { data: agreement } = await supabase
    .from("agreements")
    .select("*")
    .eq("consultation_id", consultationId)
    .maybeSingle();

  const defaultAgreementText = buildAgreementText({
    patientName: consultation.patient?.full_name ?? "Patient",
    doctorName: consultation.doctors?.name ?? "Doctor",
    diagnosis: consultation.diagnosis ?? "",
    treatmentPlan: consultation.treatment_plan ?? "",
    totalAmount: Number(consultation.total_amount ?? 0),
  });

  const agreementText = agreement?.agreement_text ?? defaultAgreementText;
  const treatmentItems = consultation.consultation_services ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <Link
          href={`/dashboard/doctor/consultation/${consultation.appointment_id}`}
          className="text-sm font-semibold text-teal-700"
        >
          ← Back to Consultation
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Treatment Agreement
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Review agreement text, save it, take patient signature, then
              download PDF.
            </p>
          </div>

          {agreement?.patient_signature ? (
            <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-bold text-green-700">
              Signed
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-700">
              Unsigned
            </span>
          )}
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

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              Agreement Text
            </h2>

            <form action={createOrUpdateAgreementAction} className="mt-5">
              <input
                type="hidden"
                name="consultation_id"
                value={consultationId}
              />

              <textarea
                name="agreement_text"
                rows={18}
                defaultValue={agreementText}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-600"
              />

              <button
                type="submit"
                className="mt-4 rounded-lg bg-teal-600 px-5 py-2.5 font-semibold text-white hover:bg-teal-700"
              >
                Save Agreement Text
              </button>
            </form>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              Selected Treatment Items
            </h2>

            <div className="mt-5 overflow-x-auto rounded-xl border">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-3">Tooth</th>
                    <th className="p-3">Service</th>
                    <th className="p-3">Note</th>
                    <th className="p-3">Price</th>
                  </tr>
                </thead>

                <tbody>
                  {treatmentItems.map((item: any) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3 font-semibold text-slate-900">
                        {item.tooth_number ?? "General"}
                      </td>
                      <td className="p-3">{item.service_name}</td>
                      <td className="p-3">{item.note ?? "-"}</td>
                      <td className="p-3 font-semibold text-slate-900">
                        ৳{Number(item.price).toLocaleString("en-BD")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-right text-xl font-bold text-slate-900">
              Total: ৳
              {Number(consultation.total_amount).toLocaleString("en-BD")}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            {agreement ? (
              <PatientSignaturePad consultationId={consultationId} />
            ) : (
              <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
                Save the agreement text first. Then the signature pad will
                appear.
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              Patient Details
            </h2>

            <div className="mt-4 space-y-3 text-sm">
              <p>
                <span className="text-slate-500">Name:</span>{" "}
                <strong>{consultation.patient?.full_name ?? "Unknown"}</strong>
              </p>

              <p>
                <span className="text-slate-500">Phone:</span>{" "}
                <strong>{consultation.patient?.phone ?? "-"}</strong>
              </p>

              <p>
                <span className="text-slate-500">Age/Sex:</span>{" "}
                <strong>
                  {consultation.patient?.age ?? "-"} /{" "}
                  {consultation.patient?.sex ?? "-"}
                </strong>
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Doctor</h2>

            <div className="mt-4 space-y-3 text-sm">
              <p>
                <span className="text-slate-500">Name:</span>{" "}
                <strong>{consultation.doctors?.name ?? "Unknown"}</strong>
              </p>

              <p>
                <span className="text-slate-500">Speciality:</span>{" "}
                <strong>
                  {consultation.doctors?.speciality ?? "Dental Surgeon"}
                </strong>
              </p>
            </div>
          </div>

          {agreement?.patient_signature && (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                Saved Signature
              </h2>

              <img
                src={agreement.patient_signature}
                alt="Patient signature"
                className="mt-4 rounded-lg border bg-white p-2"
              />

              <p className="mt-3 text-xs text-slate-500">
                Signed at: {agreement.signed_at ?? "-"}
              </p>

              <a
                href={`/dashboard/doctor/agreement/${consultationId}/pdf`}
                target="_blank"
                className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-2.5 font-semibold text-white hover:bg-slate-700"
              >
                Download PDF
              </a>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}