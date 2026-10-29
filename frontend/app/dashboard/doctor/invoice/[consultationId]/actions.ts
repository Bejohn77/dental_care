"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";
import type { PaymentMethod } from "@/types/app";

function safeString(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function safeNumber(value: FormDataEntryValue | null) {
  const valueString = safeString(value);

  if (!valueString) return 0;

  const numberValue = Number(valueString);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return 0;
  }

  return numberValue;
}

function redirectWithError(consultationId: string, message: string): never {
  redirect(
    `/dashboard/doctor/invoice/${consultationId}?error=${encodeURIComponent(
      message
    )}`
  );
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

async function checkPermissionForConsultation(consultationId: string) {
  const profile = await requireRole([
    "compounder",
    "doctor",
    "admin",
    "admin_doctor",
  ]);

  const supabase = await createClient();

  const { data: consultation, error } = await supabase
    .from("consultations")
    .select("id, appointment_id, patient_id, doctor_id, total_amount")
    .eq("id", consultationId)
    .single();

  if (error || !consultation) {
    redirect(`/dashboard/doctor?error=${encodeURIComponent("Consultation not found")}`);
  }

  if (profile.role === "doctor") {
    const linkedDoctorId = await getLinkedDoctorId(profile.id, profile.email);

    if (!linkedDoctorId || linkedDoctorId !== consultation.doctor_id) {
      redirect(
        `/dashboard/doctor?error=${encodeURIComponent(
          "You are not allowed to manage this invoice"
        )}`
      );
    }
  }

  return { profile, consultation, supabase };
}

export async function createOrUpdateInvoiceAction(formData: FormData) {
  const consultationId = safeString(formData.get("consultation_id"));
  const discountAmount = safeNumber(formData.get("discount_amount"));
  const notes = safeString(formData.get("notes"));

  if (!consultationId) {
    redirect(`/dashboard/doctor?error=${encodeURIComponent("Consultation ID missing")}`);
  }

  const { profile, consultation, supabase } =
    await checkPermissionForConsultation(consultationId);

  const subtotalAmount = Number(consultation.total_amount ?? 0);

  const { error } = await supabase.from("invoices").upsert(
    {
      consultation_id: consultation.id,
      appointment_id: consultation.appointment_id,
      patient_id: consultation.patient_id,
      doctor_id: consultation.doctor_id,
      subtotal_amount: subtotalAmount,
      discount_amount: discountAmount,
      notes: notes || null,
      created_by: profile.id,
    },
    {
      onConflict: "consultation_id",
    }
  );

  if (error) {
    redirectWithError(consultationId, error.message);
  }

  revalidatePath(`/dashboard/doctor/invoice/${consultationId}`);
  revalidatePath("/dashboard/doctor");
  revalidatePath("/dashboard/admin/appointments");

  redirect(
    `/dashboard/doctor/invoice/${consultationId}?message=${encodeURIComponent(
      "Invoice saved successfully"
    )}`
  );
}

export async function addPaymentAction(formData: FormData) {
  const consultationId = safeString(formData.get("consultation_id"));
  const invoiceId = safeString(formData.get("invoice_id"));
  const amount = safeNumber(formData.get("amount"));
  const paymentMethod = safeString(
    formData.get("payment_method")
  ) as PaymentMethod;
  const transactionReference = safeString(formData.get("transaction_reference"));
  const note = safeString(formData.get("note"));

  if (!consultationId) {
    redirect(`/dashboard/doctor?error=${encodeURIComponent("Consultation ID missing")}`);
  }

  if (!invoiceId) {
    redirectWithError(consultationId, "Invoice ID missing");
  }

  if (amount <= 0) {
    redirectWithError(consultationId, "Payment amount must be greater than 0");
  }

  const allowedMethods: PaymentMethod[] = [
    "cash",
    "card",
    "mobile_banking",
    "bank_transfer",
    "other",
  ];

  if (!allowedMethods.includes(paymentMethod)) {
    redirectWithError(consultationId, "Invalid payment method");
  }

  const { profile, consultation, supabase } =
    await checkPermissionForConsultation(consultationId);

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("consultation_id", consultation.id)
    .single();

  if (invoiceError || !invoice) {
    redirectWithError(consultationId, "Invoice not found");
  }

  if (invoice.status === "paid") {
    redirectWithError(consultationId, "This invoice is already fully paid");
  }

  if (amount > Number(invoice.due_amount)) {
    redirectWithError(
      consultationId,
      `Payment cannot be greater than due amount: ৳${Number(
        invoice.due_amount
      ).toLocaleString("en-BD")}`
    );
  }

  const { error } = await supabase.from("payments").insert({
    invoice_id: invoice.id,
    patient_id: invoice.patient_id,
    amount,
    payment_method: paymentMethod,
    transaction_reference: transactionReference || null,
    note: note || null,
    received_by: profile.id,
  });

  if (error) {
    redirectWithError(consultationId, error.message);
  }

  revalidatePath(`/dashboard/doctor/invoice/${consultationId}`);
  revalidatePath("/dashboard/doctor");
  revalidatePath("/dashboard/admin/appointments");

  redirect(
    `/dashboard/doctor/invoice/${consultationId}?message=${encodeURIComponent(
      "Payment added successfully"
    )}`
  );
}

export async function deletePaymentAction(formData: FormData) {
  const consultationId = safeString(formData.get("consultation_id"));
  const paymentId = safeString(formData.get("payment_id"));

  if (!consultationId || !paymentId) {
    redirect(`/dashboard/doctor?error=${encodeURIComponent("Payment information missing")}`);
  }

  const profile = await requireRole(["admin", "admin_doctor"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("id", paymentId);

  if (error) {
    redirectWithError(consultationId, error.message);
  }

  revalidatePath(`/dashboard/doctor/invoice/${consultationId}`);
  revalidatePath("/dashboard/doctor");

  redirect(
    `/dashboard/doctor/invoice/${consultationId}?message=${encodeURIComponent(
      "Payment deleted successfully"
    )}`
  );
}