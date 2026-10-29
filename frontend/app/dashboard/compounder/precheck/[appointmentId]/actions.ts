"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";

function safeString(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function safeNumber(value: FormDataEntryValue | null) {
  const valueString = safeString(value);

  if (!valueString) return null;

  const numberValue = Number(valueString);

  if (!Number.isFinite(numberValue)) return null;

  return numberValue;
}

function safeBoolean(value: FormDataEntryValue | null) {
  return value === "on";
}

function safeReturnPath(value: string) {
  if (!value.startsWith("/dashboard")) {
    return "/dashboard";
  }

  return value;
}

export async function savePrecheckAction(formData: FormData) {
  const profile = await requireRole([
    "compounder",
    "doctor",
    "admin",
    "admin_doctor",
  ]);

  const supabase = await createClient();

  const appointmentId = safeString(formData.get("appointment_id"));
  const patientId = safeString(formData.get("patient_id"));
  const returnTo = safeReturnPath(
    safeString(formData.get("return_to")) || "/dashboard"
  );

  const bloodPressure = safeString(formData.get("blood_pressure"));
  const pulse = safeString(formData.get("pulse"));
  const temperature = safeString(formData.get("temperature"));
  const weight = safeString(formData.get("weight"));
  const allergy = safeString(formData.get("allergy"));
  const pregnancyStatus = safeString(formData.get("pregnancy_status"));
  const diabetes = safeBoolean(formData.get("diabetes"));
  const heartDisease = safeBoolean(formData.get("heart_disease"));
  const currentMedication = safeString(formData.get("current_medication"));
  const painLevel = safeNumber(formData.get("pain_level"));
  const medicalWarning = safeString(formData.get("medical_warning"));
  const notes = safeString(formData.get("notes"));

  if (!appointmentId || !patientId) {
    redirect(
      `${returnTo}?error=${encodeURIComponent(
        "Appointment or patient information is missing"
      )}`
    );
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, patient_id, doctor_id")
    .eq("id", appointmentId)
    .single();

  if (appointmentError || !appointment) {
    redirect(
      `${returnTo}?error=${encodeURIComponent("Appointment not found")}`
    );
  }

  if (appointment.patient_id !== patientId) {
    redirect(
      `${returnTo}?error=${encodeURIComponent(
        "Patient does not match this appointment"
      )}`
    );
  }

  // If logged-in user is a normal doctor, make sure this appointment belongs to that doctor.
  if (profile.role === "doctor") {
    const { data: linkedDoctor } = await supabase
      .from("doctors")
      .select("id")
      .eq("user_id", profile.id)
      .maybeSingle();

    const doctorId = linkedDoctor?.id;

    if (!doctorId || doctorId !== appointment.doctor_id) {
      redirect(
        `${returnTo}?error=${encodeURIComponent(
          "You are not allowed to pre-check this patient"
        )}`
      );
    }
  }

  const { error } = await supabase.from("patient_prechecks").upsert(
    {
      appointment_id: appointmentId,
      patient_id: patientId,
      checked_by: profile.id,
      blood_pressure: bloodPressure || null,
      pulse: pulse || null,
      temperature: temperature || null,
      weight: weight || null,
      allergy: allergy || null,
      pregnancy_status: pregnancyStatus || null,
      diabetes,
      heart_disease: heartDisease,
      current_medication: currentMedication || null,
      pain_level: painLevel,
      medical_warning: medicalWarning || null,
      notes: notes || null,
    },
    {
      onConflict: "appointment_id",
    }
  );

  if (error) {
    redirect(
      `${returnTo}?error=${encodeURIComponent(error.message)}`
    );
  }

  await supabase
    .from("appointments")
    .update({
      status: "checked_in",
    })
    .eq("id", appointmentId)
    .in("status", ["pending", "confirmed"]);

  revalidatePath("/dashboard/compounder");
  revalidatePath("/dashboard/doctor");
  revalidatePath("/dashboard/admin/appointments");
  revalidatePath(`/dashboard/compounder/precheck/${appointmentId}`);
  revalidatePath(returnTo);

  redirect(
    `${returnTo}?message=${encodeURIComponent(
      "Pre-check saved successfully"
    )}`
  );
}