"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";

function safeString(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

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

export async function createOrUpdateAgreementAction(formData: FormData) {
  const profile = await requireRole(["doctor", "admin", "admin_doctor"]);

  const supabase = await createClient();

  const consultationId = safeString(formData.get("consultation_id"));
  const agreementText = safeString(formData.get("agreement_text"));

  if (!consultationId) {
    redirect(
      `/dashboard/doctor?error=${encodeURIComponent("Consultation ID missing")}`
    );
  }

  const { data: consultation, error: consultationError } = await supabase
    .from("consultations")
    .select(
      "*, doctors(name), patient:profiles!consultations_patient_id_fkey(full_name)"
    )
    .eq("id", consultationId)
    .single();

  if (consultationError || !consultation) {
    redirect(
      `/dashboard/doctor?error=${encodeURIComponent("Consultation not found")}`
    );
  }

  if (profile.role === "doctor") {
    const linkedDoctorId = await getLinkedDoctorId(profile.id, profile.email);

    if (!linkedDoctorId || linkedDoctorId !== consultation.doctor_id) {
      redirect(
        `/dashboard/doctor?error=${encodeURIComponent(
          "You are not allowed to manage this agreement"
        )}`
      );
    }
  }

  const finalAgreementText =
    agreementText ||
    buildAgreementText({
      patientName: consultation.patient?.full_name ?? "Patient",
      doctorName: consultation.doctors?.name ?? "Doctor",
      diagnosis: consultation.diagnosis ?? "",
      treatmentPlan: consultation.treatment_plan ?? "",
      totalAmount: Number(consultation.total_amount ?? 0),
    });

  const { error } = await supabase.from("agreements").upsert(
    {
      consultation_id: consultation.id,
      appointment_id: consultation.appointment_id,
      patient_id: consultation.patient_id,
      doctor_id: consultation.doctor_id,
      agreement_text: finalAgreementText,
    },
    {
      onConflict: "consultation_id",
    }
  );

  if (error) {
    redirect(
      `/dashboard/doctor/agreement/${consultationId}?error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath(`/dashboard/doctor/agreement/${consultationId}`);
  revalidatePath(`/dashboard/doctor/consultation/${consultation.appointment_id}`);
  revalidatePath("/dashboard/doctor");

  redirect(
    `/dashboard/doctor/agreement/${consultationId}?message=${encodeURIComponent(
      "Agreement saved successfully"
    )}`
  );
}

export async function savePatientSignatureAction(formData: FormData) {
  const profile = await requireRole(["doctor", "admin", "admin_doctor"]);

  const supabase = await createClient();

  const consultationId = safeString(formData.get("consultation_id"));
  const signature = safeString(formData.get("patient_signature"));

  if (!consultationId) {
    redirect(
      `/dashboard/doctor?error=${encodeURIComponent("Consultation ID missing")}`
    );
  }

  if (!signature) {
    redirect(
      `/dashboard/doctor/agreement/${consultationId}?error=${encodeURIComponent(
        "Patient signature is required"
      )}`
    );
  }

  const { data: consultation, error: consultationError } = await supabase
    .from("consultations")
    .select("id, doctor_id")
    .eq("id", consultationId)
    .single();

  if (consultationError || !consultation) {
    redirect(
      `/dashboard/doctor?error=${encodeURIComponent("Consultation not found")}`
    );
  }

  if (profile.role === "doctor") {
    const linkedDoctorId = await getLinkedDoctorId(profile.id, profile.email);

    if (!linkedDoctorId || linkedDoctorId !== consultation.doctor_id) {
      redirect(
        `/dashboard/doctor?error=${encodeURIComponent(
          "You are not allowed to sign this agreement"
        )}`
      );
    }
  }

  const { error } = await supabase
    .from("agreements")
    .update({
      patient_signature: signature,
      signed_at: new Date().toISOString(),
    })
    .eq("consultation_id", consultationId);

  if (error) {
    redirect(
      `/dashboard/doctor/agreement/${consultationId}?error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath(`/dashboard/doctor/agreement/${consultationId}`);
  revalidatePath("/dashboard/doctor");

  redirect(
    `/dashboard/doctor/agreement/${consultationId}?message=${encodeURIComponent(
      "Patient signature saved successfully"
    )}`
  );
}