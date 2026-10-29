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

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return 0;
  }

  return numberValue;
}

function redirectWithStatus(
  type: "message" | "error",
  message: string
): never {
  redirect(`/dashboard/admin/doctors?${type}=${encodeURIComponent(message)}`);
}

async function findProfileIdByEmail(email: string) {
  if (!email) return null;

  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  return data?.id ?? null;
}

export async function createDoctorAction(formData: FormData) {
  await requireRole(["admin", "admin_doctor"]);

  const supabase = await createClient();

  const name = safeString(formData.get("name"));
  const email = safeString(formData.get("email")).toLowerCase();
  const phone = safeString(formData.get("phone"));
  const designation = safeString(formData.get("designation"));
  const speciality = safeString(formData.get("speciality"));
  const bio = safeString(formData.get("bio"));
  const consultationFee = safeNumber(formData.get("consultation_fee"));
  const photoUrl = safeString(formData.get("photo_url"));
  const isActive = formData.get("is_active") === "on";

  if (!name) {
    redirectWithStatus("error", "Doctor name is required");
  }

  const userId = await findProfileIdByEmail(email);

  const { error } = await supabase.from("doctors").insert({
    user_id: userId,
    name,
    email: email || null,
    phone: phone || null,
    designation: designation || null,
    speciality: speciality || null,
    bio: bio || null,
    consultation_fee: consultationFee,
    photo_url: photoUrl || null,
    is_active: isActive,
  });

  if (error) {
    redirectWithStatus("error", error.message);
  }

  revalidatePath("/dashboard/admin/doctors");
  revalidatePath("/doctors");
  revalidatePath("/dashboard/doctor");

  redirectWithStatus("message", "Doctor created successfully");
}

export async function updateDoctorAction(formData: FormData) {
  await requireRole(["admin", "admin_doctor"]);

  const supabase = await createClient();

  const doctorId = safeString(formData.get("doctor_id"));
  const name = safeString(formData.get("name"));
  const email = safeString(formData.get("email")).toLowerCase();
  const phone = safeString(formData.get("phone"));
  const designation = safeString(formData.get("designation"));
  const speciality = safeString(formData.get("speciality"));
  const bio = safeString(formData.get("bio"));
  const consultationFee = safeNumber(formData.get("consultation_fee"));
  const photoUrl = safeString(formData.get("photo_url"));
  const isActive = formData.get("is_active") === "on";

  if (!doctorId) {
    redirectWithStatus("error", "Doctor ID is missing");
  }

  if (!name) {
    redirectWithStatus("error", "Doctor name is required");
  }

  const userId = await findProfileIdByEmail(email);

  const { error } = await supabase
    .from("doctors")
    .update({
      user_id: userId,
      name,
      email: email || null,
      phone: phone || null,
      designation: designation || null,
      speciality: speciality || null,
      bio: bio || null,
      consultation_fee: consultationFee,
      photo_url: photoUrl || null,
      is_active: isActive,
    })
    .eq("id", doctorId);

  if (error) {
    redirectWithStatus("error", error.message);
  }

  revalidatePath("/dashboard/admin/doctors");
  revalidatePath("/doctors");
  revalidatePath("/dashboard/doctor");

  redirectWithStatus("message", "Doctor updated successfully");
}

export async function deleteDoctorAction(formData: FormData) {
  await requireRole(["admin", "admin_doctor"]);

  const supabase = await createClient();

  const doctorId = safeString(formData.get("doctor_id"));

  if (!doctorId) {
    redirectWithStatus("error", "Doctor ID is missing");
  }

  const { error } = await supabase.from("doctors").delete().eq("id", doctorId);

  if (error) {
    redirectWithStatus("error", error.message);
  }

  revalidatePath("/dashboard/admin/doctors");
  revalidatePath("/doctors");
  revalidatePath("/dashboard/doctor");

  redirectWithStatus("message", "Doctor deleted successfully");
}