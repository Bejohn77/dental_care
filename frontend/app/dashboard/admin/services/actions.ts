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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function redirectWithStatus(
  type: "message" | "error",
  message: string
): never {
  redirect(`/dashboard/admin/services?${type}=${encodeURIComponent(message)}`);
}

export async function createServiceAction(formData: FormData) {
  await requireRole(["admin", "admin_doctor"]);

  const supabase = await createClient();

  const name = safeString(formData.get("name"));
  const manualSlug = safeString(formData.get("slug"));
  const description = safeString(formData.get("description"));
  const category = safeString(formData.get("category"));
  const basePrice = safeNumber(formData.get("base_price"));
  const isToothBased = formData.get("is_tooth_based") === "on";
  const isActive = formData.get("is_active") === "on";

  if (!name) {
    redirectWithStatus("error", "Service name is required");
  }

  const slug = manualSlug ? slugify(manualSlug) : slugify(name);

  if (!slug) {
    redirectWithStatus("error", "Valid slug is required");
  }

  const { error } = await supabase.from("services").insert({
    name,
    slug,
    description: description || null,
    category: category || null,
    base_price: basePrice,
    is_tooth_based: isToothBased,
    is_active: isActive,
  });

  if (error) {
    redirectWithStatus("error", error.message);
  }

  revalidatePath("/dashboard/admin/services");
  revalidatePath("/services");

  redirectWithStatus("message", "Service created successfully");
}

export async function updateServiceAction(formData: FormData) {
  await requireRole(["admin", "admin_doctor"]);

  const supabase = await createClient();

  const serviceId = safeString(formData.get("service_id"));
  const name = safeString(formData.get("name"));
  const manualSlug = safeString(formData.get("slug"));
  const description = safeString(formData.get("description"));
  const category = safeString(formData.get("category"));
  const basePrice = safeNumber(formData.get("base_price"));
  const isToothBased = formData.get("is_tooth_based") === "on";
  const isActive = formData.get("is_active") === "on";

  if (!serviceId) {
    redirectWithStatus("error", "Service ID is missing");
  }

  if (!name) {
    redirectWithStatus("error", "Service name is required");
  }

  const slug = manualSlug ? slugify(manualSlug) : slugify(name);

  const { error } = await supabase
    .from("services")
    .update({
      name,
      slug,
      description: description || null,
      category: category || null,
      base_price: basePrice,
      is_tooth_based: isToothBased,
      is_active: isActive,
    })
    .eq("id", serviceId);

  if (error) {
    redirectWithStatus("error", error.message);
  }

  revalidatePath("/dashboard/admin/services");
  revalidatePath("/services");

  redirectWithStatus("message", "Service updated successfully");
}

export async function deleteServiceAction(formData: FormData) {
  await requireRole(["admin", "admin_doctor"]);

  const supabase = await createClient();

  const serviceId = safeString(formData.get("service_id"));

  if (!serviceId) {
    redirectWithStatus("error", "Service ID is missing");
  }

  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", serviceId);

  if (error) {
    redirectWithStatus("error", error.message);
  }

  revalidatePath("/dashboard/admin/services");
  revalidatePath("/services");

  redirectWithStatus("message", "Service deleted successfully");
}