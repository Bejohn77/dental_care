"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";
import type { AppointmentStatus } from "@/types/app";

function safeString(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

const allowedStatuses: AppointmentStatus[] = [
  "pending",
  "confirmed",
  "checked_in",
  "in_consultation",
  "completed",
  "cancelled",
];

export async function updateAppointmentStatusAction(formData: FormData) {
  await requireRole(["compounder", "doctor", "admin", "admin_doctor"]);

  const supabase = await createClient();

  const appointmentId = safeString(formData.get("appointment_id"));
  const status = safeString(formData.get("status")) as AppointmentStatus;
  const returnTo = safeString(formData.get("return_to")) || "/dashboard";

  if (!appointmentId) {
    redirect(`${returnTo}?error=${encodeURIComponent("Appointment ID missing")}`);
  }

  if (!allowedStatuses.includes(status)) {
    redirect(`${returnTo}?error=${encodeURIComponent("Invalid appointment status")}`);
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId);

  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/admin/appointments");
  revalidatePath("/dashboard/compounder");
  revalidatePath("/dashboard/doctor");
  revalidatePath("/dashboard/patient");

  redirect(`${returnTo}?message=${encodeURIComponent("Appointment updated")}`);
}