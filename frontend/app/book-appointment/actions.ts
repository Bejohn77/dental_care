"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";
import type { AvailableSlot } from "@/types/app";

function safeString(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function redirectWithStatus(
  type: "message" | "error",
  message: string
): never {
  redirect(`/book-appointment?${type}=${encodeURIComponent(message)}`);
}

export async function createAppointmentAction(formData: FormData) {
  const profile = await requireRole(["patient"]);

  const supabase = await createClient();

  const doctorId = safeString(formData.get("doctor_id"));
  const appointmentDate = safeString(formData.get("appointment_date"));
  const startTime = safeString(formData.get("start_time"));
  const reason = safeString(formData.get("reason"));

  if (!doctorId) {
    redirectWithStatus("error", "Please select a doctor");
  }

  if (!appointmentDate) {
    redirectWithStatus("error", "Please select an appointment date");
  }

  if (!startTime) {
    redirectWithStatus("error", "Please select an available time slot");
  }

  const { data: availableSlots, error: slotError } = await supabase.rpc(
    "get_available_slots",
    {
      p_doctor_id: doctorId,
      p_date: appointmentDate,
    }
  );

  if (slotError) {
    redirectWithStatus("error", slotError.message);
  }

  const selectedSlot = ((availableSlots ?? []) as AvailableSlot[]).find(
    (slot) => slot.start_time === startTime
  );

  if (!selectedSlot) {
    redirectWithStatus(
      "error",
      "This time slot is no longer available. Please select another slot."
    );
  }

  const { error } = await supabase.from("appointments").insert({
    patient_id: profile.id,
    doctor_id: doctorId,
    appointment_date: appointmentDate,
    start_time: selectedSlot.start_time,
    end_time: selectedSlot.end_time,
    reason: reason || null,
    status: "pending",
    created_by: profile.id,
  });

  if (error) {
    redirectWithStatus("error", error.message);
  }

  revalidatePath("/dashboard/patient");
  revalidatePath("/dashboard/admin/appointments");
  revalidatePath("/dashboard/doctor");
  revalidatePath("/dashboard/compounder");

  redirect(
    `/dashboard/patient?message=${encodeURIComponent(
      "Appointment booked successfully"
    )}`
  );
}