import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";

type PatientHistoryPageProps = {
  searchParams: Promise<{
    patientId?: string;
  }>;
};

function money(value: number | string | null | undefined) {
  return `৳${Number(value ?? 0).toLocaleString("en-BD")}`;
}

function shortTime(time: string | null | undefined) {
  return time ? time.slice(0, 5) : "-";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function relationArray(value: any) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function statusBadgeClass(status: string) {
  if (status === "paid" || status === "completed" || status === "signed") {
    return "bg-green-100 text-green-700";
  }

  if (status === "partial" || status === "pending" || status === "checked_in") {
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

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default async function PatientHistoryPage({
  searchParams,
}: PatientHistoryPageProps) {
  const profile = await requireRole([
    "compounder",
    "doctor",
    "admin",
    "admin_doctor",
  ]);

  const params = await searchParams;
  const patientId = params?.patientId;

  const supabase = await createClient();

  if (!patientId) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-red-700">Patient ID Missing</h1>

        <p className="mt-2 text-slate-600">
          Please open this page from the patient list.
        </p>

        <Link
          href={
            profile.role === "doctor"
              ? "/dashboard/doctor/patients"
              : "/dashboard/admin/patients"
          }
          className="mt-5 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Back to Patients
        </Link>
      </div>
    );
  }

  if (profile.role === "doctor") {
    const linkedDoctorId = await getLinkedDoctorId(profile.id, profile.email);

    if (!linkedDoctorId) {
      redirect(
        `/dashboard/doctor?error=${encodeURIComponent(
          "Your doctor account is not linked"
        )}`
      );
    }

    const { count } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .eq("doctor_id", linkedDoctorId);

    if (!count) {
      redirect(
        `/dashboard/doctor?error=${encodeURIComponent(
          "You are not allowed to view this patient history"
        )}`
      );
    }
  }

  const { data: patient, error: patientError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", patientId)
    .maybeSingle();

  if (patientError) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-red-700">
          Could not load patient
        </h1>

        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {patientError.message}
        </div>

        <Link
          href={
            profile.role === "doctor"
              ? "/dashboard/doctor/patients"
              : "/dashboard/admin/patients"
          }
          className="mt-5 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Back to Patients
        </Link>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-red-700">Patient not found</h1>

        <p className="mt-3 text-sm text-slate-600">
          No profile was found for this ID:
        </p>

        <div className="mt-3 rounded-lg border bg-slate-50 p-3 font-mono text-sm text-slate-700">
          {patientId}
        </div>

        <Link
          href={
            profile.role === "doctor"
              ? "/dashboard/doctor/patients"
              : "/dashboard/admin/patients"
          }
          className="mt-5 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Back to Patients
        </Link>
      </div>
    );
  }

  if (patient.role !== "patient") {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-red-700">
          This profile is not a patient
        </h1>

        <p className="mt-3 text-sm text-slate-600">
          Current role: <strong>{patient.role}</strong>
        </p>

        <Link
          href={
            profile.role === "doctor"
              ? "/dashboard/doctor/patients"
              : "/dashboard/admin/patients"
          }
          className="mt-5 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Back to Patients
        </Link>
      </div>
    );
  }

  const [
    appointmentsResult,
    prechecksResult,
    consultationsResult,
    invoicesResult,
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("*, doctors(name, speciality)")
      .eq("patient_id", patientId)
      .order("appointment_date", { ascending: false })
      .order("start_time", { ascending: false }),

    supabase
      .from("patient_prechecks")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),

    supabase
      .from("consultations")
      .select(
        "*, doctors(name, speciality), consultation_services(*), agreements(*)"
      )
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),

    supabase
      .from("invoices")
      .select("*, doctors(name, speciality)")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
  ]);

  const appointments = appointmentsResult.data ?? [];
  const prechecks = prechecksResult.data ?? [];
  const consultations = consultationsResult.data ?? [];
  const invoices = invoicesResult.data ?? [];

  const invoiceIds = invoices.map((invoice: any) => invoice.id);

  let payments: any[] = [];

  if (invoiceIds.length > 0) {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .in("invoice_id", invoiceIds)
      .order("created_at", { ascending: false });

    payments = data ?? [];
  }

  const paymentsByInvoice = new Map<string, any[]>();

  for (const payment of payments) {
    const existing = paymentsByInvoice.get(payment.invoice_id) ?? [];
    existing.push(payment);
    paymentsByInvoice.set(payment.invoice_id, existing);
  }

  const precheckByAppointment = new Map<string, any>();

  for (const precheck of prechecks) {
    precheckByAppointment.set(precheck.appointment_id, precheck);
  }

  const consultationByAppointment = new Map<string, any>();

  for (const consultation of consultations) {
    consultationByAppointment.set(consultation.appointment_id, consultation);
  }

  const invoiceByConsultation = new Map<string, any>();

  for (const invoice of invoices) {
    invoiceByConsultation.set(invoice.consultation_id, invoice);
  }

  const totalInvoiceAmount = invoices.reduce(
    (sum: number, invoice: any) => sum + Number(invoice.total_amount ?? 0),
    0
  );

  const totalPaidAmount = invoices.reduce(
    (sum: number, invoice: any) => sum + Number(invoice.paid_amount ?? 0),
    0
  );

  const totalDueAmount = invoices.reduce(
    (sum: number, invoice: any) => sum + Number(invoice.due_amount ?? 0),
    0
  );

  const signedAgreements = consultations.filter((consultation: any) => {
    const agreement = relationArray(consultation.agreements)[0];
    return Boolean(agreement?.patient_signature);
  }).length;

  const dataErrors = [
    appointmentsResult.error?.message,
    prechecksResult.error?.message,
    consultationsResult.error?.message,
    invoicesResult.error?.message,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href={
                profile.role === "doctor"
                  ? "/dashboard/doctor/patients"
                  : "/dashboard/admin/patients"
              }
              className="text-sm font-semibold text-teal-700"
            >
              ← Back to Patients
            </Link>

            <h1 className="mt-4 text-2xl font-bold text-slate-900">
              Patient History
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Full clinical and financial timeline for this patient.
            </p>
          </div>

          <div className="rounded-xl bg-teal-50 px-5 py-3 text-right">
            <p className="text-xs font-semibold uppercase text-teal-700">
              Total Due
            </p>
            <p className="text-2xl font-bold text-teal-800">
              {money(totalDueAmount)}
            </p>
          </div>
        </div>

        {dataErrors.length > 0 && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {dataErrors[0]}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              Patient Profile
            </h2>

            <div className="mt-5 space-y-4 text-sm">
              <InfoRow label="Name" value={patient.full_name} />
              <InfoRow label="Phone" value={patient.phone ?? "-"} />
              <InfoRow label="Email" value={patient.email ?? "-"} />
              <InfoRow
                label="Age / Sex"
                value={`${patient.age ?? "-"} / ${patient.sex ?? "-"}`}
              />
              <InfoRow label="Address" value={patient.address ?? "-"} />
              <InfoRow
                label="Registered"
                value={formatDateTime(patient.created_at)}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Summary</h2>

            <div className="mt-5 grid gap-3">
              <div className="rounded-xl border p-4">
                <p className="text-sm text-slate-500">Appointments</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {appointments.length}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-sm text-slate-500">Consultations</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {consultations.length}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-sm text-slate-500">Signed Agreements</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {signedAgreements}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-sm text-slate-500">Invoice Value</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {money(totalInvoiceAmount)}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-sm text-slate-500">Paid</p>
                <p className="mt-1 text-xl font-bold text-green-700">
                  {money(totalPaidAmount)}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-sm text-slate-500">Due</p>
                <p className="mt-1 text-xl font-bold text-red-700">
                  {money(totalDueAmount)}
                </p>
              </div>
            </div>
          </div>
        </aside>

        <main className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              Treatment Timeline
            </h2>

            <div className="mt-5 space-y-5">
              {appointments.length === 0 && (
                <p className="text-sm text-slate-600">
                  No appointment history found.
                </p>
              )}

              {appointments.map((appointment: any) => {
                const precheck = precheckByAppointment.get(appointment.id);
                const consultation = consultationByAppointment.get(
                  appointment.id
                );
                const agreement = consultation
                  ? relationArray(consultation.agreements)[0]
                  : null;
                const invoice = consultation
                  ? invoiceByConsultation.get(consultation.id)
                  : null;
                const invoicePayments = invoice
                  ? paymentsByInvoice.get(invoice.id) ?? []
                  : [];

                const treatmentItems = consultation
                  ? relationArray(consultation.consultation_services)
                  : [];

                return (
                  <article
                    key={appointment.id}
                    className="rounded-2xl border p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          {appointment.appointment_date} —{" "}
                          {shortTime(appointment.start_time)} to{" "}
                          {shortTime(appointment.end_time)}
                        </h3>

                        <p className="mt-1 text-sm text-slate-600">
                          Doctor:{" "}
                          <strong>
                            {appointment.doctors?.name ?? "Unknown"}
                          </strong>{" "}
                          /{" "}
                          {appointment.doctors?.speciality ?? "Dental Surgeon"}
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          Reason: {appointment.reason ?? "-"}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusBadgeClass(
                          appointment.status
                        )}`}
                      >
                        {appointment.status.replace("_", " ")}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-4">
                        <h4 className="font-semibold text-slate-900">
                          Pre-Check
                        </h4>

                        {!precheck ? (
                          <p className="mt-2 text-sm text-amber-700">
                            No pre-check found.
                          </p>
                        ) : (
                          <div className="mt-3 space-y-1 text-sm text-slate-700">
                            <p>BP: {precheck.blood_pressure ?? "-"}</p>
                            <p>Pulse: {precheck.pulse ?? "-"}</p>
                            <p>Temperature: {precheck.temperature ?? "-"}</p>
                            <p>Weight: {precheck.weight ?? "-"}</p>
                            <p>Pain Level: {precheck.pain_level ?? "-"}</p>

                            {precheck.allergy && (
                              <p className="font-semibold text-amber-700">
                                Allergy: {precheck.allergy}
                              </p>
                            )}

                            {precheck.diabetes && (
                              <p className="font-semibold text-red-700">
                                Diabetes
                              </p>
                            )}

                            {precheck.heart_disease && (
                              <p className="font-semibold text-red-700">
                                Heart disease
                              </p>
                            )}

                            {precheck.pregnancy_status && (
                              <p className="font-semibold text-red-700">
                                Pregnancy: {precheck.pregnancy_status}
                              </p>
                            )}

                            {precheck.medical_warning && (
                              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-red-700">
                                {precheck.medical_warning}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl bg-slate-50 p-4">
                        <h4 className="font-semibold text-slate-900">
                          Consultation
                        </h4>

                        {!consultation ? (
                          <p className="mt-2 text-sm text-amber-700">
                            No consultation saved.
                          </p>
                        ) : (
                          <div className="mt-3 space-y-2 text-sm">
                            <p>
                              <span className="text-slate-500">
                                Diagnosis:
                              </span>{" "}
                              <strong>
                                {consultation.diagnosis ?? "-"}
                              </strong>
                            </p>

                            <p>
                              <span className="text-slate-500">
                                Treatment Plan:
                              </span>{" "}
                              <strong>
                                {consultation.treatment_plan ?? "-"}
                              </strong>
                            </p>

                            <p>
                              <span className="text-slate-500">Total:</span>{" "}
                              <strong>
                                {money(consultation.total_amount)}
                              </strong>
                            </p>

                            <Link
                              href={`/dashboard/doctor/consultation/${appointment.id}`}
                              className="inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
                            >
                              Open Consultation
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>

                    {treatmentItems.length > 0 && (
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
                            {treatmentItems.map((item: any) => (
                              <tr key={item.id} className="border-t">
                                <td className="p-3 font-semibold">
                                  {item.tooth_number ?? "General"}
                                </td>

                                <td className="p-3">{item.service_name}</td>

                                <td className="p-3">{item.note ?? "-"}</td>

                                <td className="p-3 text-right font-semibold">
                                  {money(item.price)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border p-4">
                        <h4 className="font-semibold text-slate-900">
                          Agreement
                        </h4>

                        {!consultation ? (
                          <p className="mt-2 text-sm text-slate-500">
                            Not ready.
                          </p>
                        ) : agreement?.patient_signature ? (
                          <div className="mt-3 space-y-2">
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                              Signed
                            </span>

                            <p className="text-xs text-slate-500">
                              Signed at: {formatDateTime(agreement.signed_at)}
                            </p>

                            <Link
                              href={`/dashboard/doctor/agreement/${consultation.id}`}
                              className="inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              View Agreement
                            </Link>
                          </div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                              Pending
                            </span>

                            <Link
                              href={`/dashboard/doctor/agreement/${consultation.id}`}
                              className="inline-block rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              Create Agreement
                            </Link>
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border p-4">
                        <h4 className="font-semibold text-slate-900">
                          Invoice & Payment
                        </h4>

                        {!consultation ? (
                          <p className="mt-2 text-sm text-slate-500">
                            Not ready.
                          </p>
                        ) : !invoice ? (
                          <div className="mt-3 space-y-2">
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                              Invoice pending
                            </span>

                            <Link
                              href={`/dashboard/doctor/invoice/${consultation.id}`}
                              className="inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              Create Invoice
                            </Link>
                          </div>
                        ) : (
                          <div className="mt-3 space-y-2 text-sm">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusBadgeClass(
                                invoice.status
                              )}`}
                            >
                              {invoice.status}
                            </span>

                            <p>Total: {money(invoice.total_amount)}</p>
                            <p className="text-green-700">
                              Paid: {money(invoice.paid_amount)}
                            </p>
                            <p className="text-red-700">
                              Due: {money(invoice.due_amount)}
                            </p>

                            <Link
                              href={`/dashboard/doctor/invoice/${consultation.id}`}
                              className="inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              View Invoice
                            </Link>

                            {invoicePayments.length > 0 && (
                              <div className="mt-3 rounded-lg bg-slate-50 p-3">
                                <p className="text-xs font-semibold uppercase text-slate-500">
                                  Payments
                                </p>

                                <div className="mt-2 space-y-1">
                                  {invoicePayments.map((payment: any) => (
                                    <p key={payment.id} className="text-xs">
                                      {formatDateTime(payment.created_at)} —{" "}
                                      <strong>{money(payment.amount)}</strong>{" "}
                                      (
                                      {payment.payment_method?.replace(
                                        "_",
                                        " "
                                      )}
                                      )
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}