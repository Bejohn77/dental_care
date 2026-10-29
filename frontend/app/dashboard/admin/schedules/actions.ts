"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";

function safeString(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function safeNumber(value: FormDataEntryValue | null) {
  const numberValue = Number(safeString(value));

  if (!Number.isFinite(numberValue)) return 0;

  return numberValue;
}

function redirectWithStatus(
  type: "message" | "error",
  message: string
): never {
  redirect(`/dashboard/admin/schedules?${type}=${encodeURIComponent(message)}`);
}

export async function createScheduleAction(formData: FormData) {
  await requireRole(["admin", "admin_doctor"]);

  const supabase = await createClient();

  const doctorId = safeString(formData.get("doctor_id"));
  const dayOfWeek = safeNumber(formData.get("day_of_week"));
  const startTime = safeString(formData.get("start_time"));
  const endTime = safeString(formData.get("end_time"));
  const slotMinutes = safeNumber(formData.get("slot_minutes"));
  const isActive = formData.get("is_active") === "on";

  if (!doctorId) {
    redirectWithStatus("error", "Please select a doctor");
  }

  if (dayOfWeek < 0 || dayOfWeek > 6) {
    redirectWithStatus("error", "Invalid day selected");
  }

  if (!startTime || !endTime || startTime >= endTime) {
    redirectWithStatus("error", "Start time must be before end time");
  }

  if (slotMinutes < 5 || slotMinutes > 180) {
    redirectWithStatus("error", "Slot duration must be between 5 and 180 minutes");
  }

  const { error } = await supabase.from("doctor_schedules").insert({
    doctor_id: doctorId,
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
    slot_minutes: slotMinutes,
    is_active: isActive,
  });

  if (error) {
    redirectWithStatus("error", error.message);
  }

  revalidatePath("/dashboard/admin/schedules");
  revalidatePath("/book-appointment");

  redirectWithStatus("message", "Schedule created successfully");
}

export async function updateScheduleAction(formData: FormData) {
  await requireRole(["admin", "admin_doctor"]);

  const supabase = await createClient();

  const scheduleId = safeString(formData.get("schedule_id"));
  const doctorId = safeString(formData.get("doctor_id"));
  const dayOfWeek = safeNumber(formData.get("day_of_week"));
  const startTime = safeString(formData.get("start_time"));
  const endTime = safeString(formData.get("end_time"));
  const slotMinutes = safeNumber(formData.get("slot_minutes"));
  const isActive = formData.get("is_active") === "on";

  if (!scheduleId) {
    redirectWithStatus("error", "Schedule ID is missing");
  }

  if (!doctorId) {
    redirectWithStatus("error", "Please select a doctor");
  }

  if (!startTime || !endTime || startTime >= endTime) {
    redirectWithStatus("error", "Start time must be before end time");
  }

  const { error } = await supabase
    .from("doctor_schedules")
    .update({
      doctor_id: doctorId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      slot_minutes: slotMinutes,
      is_active: isActive,
    })
    .eq("id", scheduleId);

  if (error) {
    redirectWithStatus("error", error.message);
  }

  revalidatePath("/dashboard/admin/schedules");
  revalidatePath("/book-appointment");

  redirectWithStatus("message", "Schedule updated successfully");
}

export async function deleteScheduleAction(formData: FormData) {
  await requireRole(["admin", "admin_doctor"]);

  const supabase = await createClient();

  const scheduleId = safeString(formData.get("schedule_id"));

  if (!scheduleId) {
    redirectWithStatus("error", "Schedule ID is missing");
  }

  const { error } = await supabase
    .from("doctor_schedules")
    .delete()
    .eq("id", scheduleId);

  if (error) {
    redirectWithStatus("error", error.message);
  }

  revalidatePath("/dashboard/admin/schedules");
  revalidatePath("/book-appointment");

  redirectWithStatus("message", "Schedule deleted successfully");
}