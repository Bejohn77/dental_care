"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";
import type { DentalService } from "@/types/app";

type IncomingTreatmentItem = {
  tooth_number: string | null;
  service_id: string;
  note: string;
};

function safeString(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function parseTreatmentItems(value: string): IncomingTreatmentItem[] {
  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => ({
        tooth_number:
          typeof item.tooth_number === "string" && item.tooth_number.trim()
            ? item.tooth_number.trim()
            : null,
        service_id:
          typeof item.service_id === "string" ? item.service_id.trim() : "",
        note: typeof item.note === "string" ? item.note.trim() : "",
      }))
      .filter((item) => item.service_id);
  } catch {
    return [];
  }
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

function redirectWithError(appointmentId: string, message: string): never {
  redirect(
    `/dashboard/doctor/consultation/${appointmentId}?error=${encodeURIComponent(
      message
    )}`
  );
}

export async function saveConsultationAction(formData: FormData) {
  const profile = await requireRole(["doctor", "admin", "admin_doctor"]);

  const supabase = await createClient();

  const appointmentId = safeString(formData.get("appointment_id"));
  const diagnosis = safeString(formData.get("diagnosis"));
  const treatmentPlan = safeString(formData.get("treatment_plan"));
  const doctorNotes = safeString(formData.get("doctor_notes"));
  const consultationItemsRaw = safeString(formData.get("consultation_items"));
  const incomingItems = parseTreatmentItems(consultationItemsRaw);

  if (!appointmentId) {
    redirect(`/dashboard/doctor?error=${encodeURIComponent("Appointment ID missing")}`);
  }

  if (incomingItems.length === 0) {
    redirectWithError(appointmentId, "Please add at least one treatment item");
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, patient_id, doctor_id, status")
    .eq("id", appointmentId)
    .single();

  if (appointmentError || !appointment) {
    redirect(`/dashboard/doctor?error=${encodeURIComponent("Appointment not found")}`);
  }

  if (profile.role === "doctor") {
    const linkedDoctorId = await getLinkedDoctorId(profile.id, profile.email);

    if (!linkedDoctorId || linkedDoctorId !== appointment.doctor_id) {
      redirect(
        `/dashboard/doctor?error=${encodeURIComponent(
          "You are not allowed to edit this appointment"
        )}`
      );
    }
  }
  const { data: precheck } = await supabase
  .from("patient_prechecks")
  .select("id")
  .eq("appointment_id", appointmentId)
  .maybeSingle();

if (!precheck) {
  redirectWithError(
    appointmentId,
    "Pre-check is required before saving consultation. Compounder or doctor can fill it first."
  );
}

  const uniqueServiceIds = Array.from(
    new Set(incomingItems.map((item) => item.service_id))
  );

  const { data: serviceData, error: serviceError } = await supabase
    .from("services")
    .select("*")
    .in("id", uniqueServiceIds)
    .eq("is_active", true);

  if (serviceError) {
    redirectWithError(appointmentId, serviceError.message);
  }

  const services = (serviceData ?? []) as DentalService[];
  const serviceMap = new Map(services.map((service) => [service.id, service]));

  const finalItems = [];

  for (const item of incomingItems) {
    const service = serviceMap.get(item.service_id);

    if (!service) {
      redirectWithError(
        appointmentId,
        "One or more selected services are invalid or inactive"
      );
    }

    if (service.is_tooth_based && !item.tooth_number) {
      redirectWithError(appointmentId, `${service.name} requires tooth selection`);
    }

    finalItems.push({
      tooth_number: item.tooth_number,
      service_id: service.id,
      service_name: service.name,
      price: Number(service.base_price),
      note: item.note || null,
    });
  }

  const totalAmount = finalItems.reduce(
    (sum, item) => sum + Number(item.price),
    0
  );

  const { data: consultation, error: consultationError } = await supabase
    .from("consultations")
    .upsert(
      {
        appointment_id: appointment.id,
        patient_id: appointment.patient_id,
        doctor_id: appointment.doctor_id,
        diagnosis: diagnosis || null,
        treatment_plan: treatmentPlan || null,
        doctor_notes: doctorNotes || null,
        total_amount: totalAmount,
      },
      {
        onConflict: "appointment_id",
      }
    )
    .select("id")
    .single();

  if (consultationError || !consultation) {
    redirectWithError(
      appointmentId,
      consultationError?.message ?? "Consultation save failed"
    );
  }

  const consultationId = consultation.id as string;

  const { error: deleteError } = await supabase
    .from("consultation_services")
    .delete()
    .eq("consultation_id", consultationId);

  if (deleteError) {
    redirectWithError(appointmentId, deleteError.message);
  }

  const rows = finalItems.map((item) => ({
    consultation_id: consultationId,
    tooth_number: item.tooth_number,
    service_id: item.service_id,
    service_name: item.service_name,
    price: item.price,
    note: item.note,
  }));

  const { error: insertError } = await supabase
    .from("consultation_services")
    .insert(rows);

  if (insertError) {
    redirectWithError(appointmentId, insertError.message);
  }

  await supabase
    .from("appointments")
    .update({
      status: "in_consultation",
    })
    .eq("id", appointment.id)
    .in("status", ["pending", "confirmed", "checked_in"]);

  revalidatePath("/dashboard/doctor");
  revalidatePath("/dashboard/admin/appointments");
  revalidatePath(`/dashboard/doctor/consultation/${appointmentId}`);

  redirect(
    `/dashboard/doctor/consultation/${appointmentId}?message=${encodeURIComponent(
      "Consultation saved successfully"
    )}`
  );
}