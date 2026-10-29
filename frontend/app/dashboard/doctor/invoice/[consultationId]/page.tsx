import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";
import PrintButton from "@/components/common/PrintButton";
import {
  addPaymentAction,
  createOrUpdateInvoiceAction,
  deletePaymentAction,
} from "./actions";

type InvoicePageProps = {
  params: Promise<{
    consultationId: string;
  }>;
  searchParams: Promise<{
    message?: string;
    error?: string;
  }>;
};

function money(value: number | string | null | undefined) {
  return `৳${Number(value ?? 0).toLocaleString("en-BD")}`;
}

function statusBadgeClass(status: string) {
  if (status === "paid") {
    return "bg-green-100 text-green-700";
  }

  if (status === "partial") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "cancelled") {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
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

export default async function InvoicePage({
  params,
  searchParams,
}: InvoicePageProps) {
  const profile = await requireRole([
    "compounder",
    "doctor",
    "admin",
    "admin_doctor",
  ]);

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
          "You are not allowed to open this invoice"
        )}`
      );
    }
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("consultation_id", consultationId)
    .maybeSingle();

  let payments: any[] = [];

  if (invoice) {
    const { data: paymentsData } = await supabase
      .from("payments")
      .select("*, receiver:profiles!payments_received_by_fkey(full_name)")
      .eq("invoice_id", invoice.id)
      .order("created_at", { ascending: false });

    payments = paymentsData ?? [];
  }

  const treatmentItems = consultation.consultation_services ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm print:shadow-none">
        <Link
          href={`/dashboard/doctor/consultation/${consultation.appointment_id}`}
          className="text-sm font-semibold text-teal-700 print:hidden"
        >
          ← Back to Consultation
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Invoice & Payment
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Generate invoice from consultation, add payments, and track due
              amount.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {invoice && <PrintButton />}

            {invoice && (
              <span
                className={`rounded-full px-4 py-2 text-sm font-bold capitalize ${statusBadgeClass(
                  invoice.status
                )}`}
              >
                {invoice.status}
              </span>
            )}
          </div>
        </div>

        {query?.message && (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 print:hidden">
            {query.message}
          </div>
        )}

        {query?.error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 print:hidden">
            {query.error}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm print:shadow-none">
            <h2 className="text-lg font-bold text-slate-900">
              Patient & Doctor
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border p-4">
                <p className="text-sm text-slate-500">Patient</p>

                <p className="mt-1 font-bold text-slate-900">
                  {consultation.patient?.full_name ?? "Unknown"}
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  Phone: {consultation.patient?.phone ?? "-"}
                </p>

                <p className="text-sm text-slate-600">
                  Age/Sex: {consultation.patient?.age ?? "-"} /{" "}
                  {consultation.patient?.sex ?? "-"}
                </p>

                <p className="text-sm text-slate-600">
                  Address: {consultation.patient?.address ?? "-"}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-sm text-slate-500">Doctor</p>

                <p className="mt-1 font-bold text-slate-900">
                  {consultation.doctors?.name ?? "Unknown"}
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  {consultation.doctors?.speciality ?? "Dental Surgeon"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm print:shadow-none">
            <h2 className="text-lg font-bold text-slate-900">
              Treatment Items
            </h2>

            <div className="mt-5 overflow-x-auto rounded-xl border">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-3">Tooth</th>
                    <th className="p-3">Service</th>
                    <th className="p-3">Note</th>
                    <th className="p-3 text-right">Price</th>
                  </tr>
                </thead>

                <tbody>
                  {treatmentItems.length === 0 && (
                    <tr>
                      <td className="p-4 text-slate-600" colSpan={4}>
                        No treatment items found.
                      </td>
                    </tr>
                  )}

                  {treatmentItems.map((item: any) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3 font-semibold text-slate-900">
                        {item.tooth_number ?? "General"}
                      </td>

                      <td className="p-3">{item.service_name}</td>

                      <td className="p-3">{item.note ?? "-"}</td>

                      <td className="p-3 text-right font-semibold text-slate-900">
                        {money(item.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-right text-xl font-bold text-slate-900">
              Consultation Total: {money(consultation.total_amount)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm print:hidden">
            <h2 className="text-lg font-bold text-slate-900">
              Generate / Update Invoice
            </h2>

            <form
              action={createOrUpdateInvoiceAction}
              className="mt-5 grid gap-4 md:grid-cols-2"
            >
              <input
                type="hidden"
                name="consultation_id"
                value={consultationId}
              />

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Subtotal
                </label>

                <input
                  value={Number(consultation.total_amount)}
                  readOnly
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Discount Amount
                </label>

                <input
                  name="discount_amount"
                  type="number"
                  min={0}
                  step="1"
                  defaultValue={invoice?.discount_amount ?? 0}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">
                  Invoice Notes
                </label>

                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={invoice?.notes ?? ""}
                  placeholder="Optional note for invoice"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="rounded-lg bg-teal-600 px-5 py-2.5 font-semibold text-white hover:bg-teal-700"
                >
                  Save Invoice
                </button>
              </div>
            </form>
          </div>

          {invoice && (
            <div className="rounded-2xl bg-white p-6 shadow-sm print:shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900">
                  Payment History
                </h2>

                <PrintButton />
              </div>

              <div className="mt-5 overflow-x-auto rounded-xl border">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Method</th>
                      <th className="p-3">Reference</th>
                      <th className="p-3">Received By</th>
                      <th className="p-3 print:hidden">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {payments.length === 0 && (
                      <tr>
                        <td className="p-4 text-slate-600" colSpan={6}>
                          No payment recorded yet.
                        </td>
                      </tr>
                    )}

                    {payments.map((payment: any) => (
                      <tr key={payment.id} className="border-t">
                        <td className="p-3">
                          {payment.created_at
                            ? new Date(payment.created_at).toLocaleString()
                            : "-"}
                        </td>

                        <td className="p-3 font-semibold text-slate-900">
                          {money(payment.amount)}
                        </td>

                        <td className="p-3 capitalize">
                          {payment.payment_method.replace("_", " ")}
                        </td>

                        <td className="p-3">
                          {payment.transaction_reference ?? "-"}
                        </td>

                        <td className="p-3">
                          {payment.receiver?.full_name ?? "-"}
                        </td>

                        <td className="p-3 print:hidden">
                          {["admin", "admin_doctor"].includes(
                            profile.role
                          ) && (
                            <form action={deletePaymentAction}>
                              <input
                                type="hidden"
                                name="consultation_id"
                                value={consultationId}
                              />

                              <input
                                type="hidden"
                                name="payment_id"
                                value={payment.id}
                              />

                              <button
                                type="submit"
                                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm print:shadow-none">
            <h2 className="text-lg font-bold text-slate-900">
              Invoice Summary
            </h2>

            {!invoice ? (
              <div className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
                Invoice has not been generated yet. Save the invoice first.
              </div>
            ) : (
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <strong>{money(invoice.subtotal_amount)}</strong>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Discount</span>
                  <strong>{money(invoice.discount_amount)}</strong>
                </div>

                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total</span>
                    <strong>{money(invoice.total_amount)}</strong>
                  </div>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Paid</span>
                  <strong className="text-green-700">
                    {money(invoice.paid_amount)}
                  </strong>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Due</span>
                  <strong className="text-red-700">
                    {money(invoice.due_amount)}
                  </strong>
                </div>

                <div className="border-t pt-3">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-bold capitalize ${statusBadgeClass(
                      invoice.status
                    )}`}
                  >
                    {invoice.status}
                  </span>
                </div>
              </div>
            )}
          </div>

          {invoice && invoice.status !== "paid" && (
            <div className="rounded-2xl bg-white p-6 shadow-sm print:hidden">
              <h2 className="text-lg font-bold text-slate-900">Add Payment</h2>

              <form action={addPaymentAction} className="mt-5 space-y-4">
                <input
                  type="hidden"
                  name="consultation_id"
                  value={consultationId}
                />

                <input type="hidden" name="invoice_id" value={invoice.id} />

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Payment Amount
                  </label>

                  <input
                    name="amount"
                    type="number"
                    min={1}
                    max={Number(invoice.due_amount)}
                    step="1"
                    required
                    placeholder={`Due: ${Number(invoice.due_amount)}`}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Payment Method
                  </label>

                  <select
                    name="payment_method"
                    defaultValue="cash"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="mobile_banking">Mobile Banking</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Transaction Reference
                  </label>

                  <input
                    name="transaction_reference"
                    placeholder="bKash/Nagad/Card/Bank reference"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Note
                  </label>

                  <textarea
                    name="note"
                    rows={3}
                    placeholder="Optional payment note"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-slate-900 px-5 py-2.5 font-semibold text-white hover:bg-slate-700"
                >
                  Add Payment
                </button>
              </form>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}