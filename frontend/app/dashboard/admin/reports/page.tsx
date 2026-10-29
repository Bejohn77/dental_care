import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";

type ReportsPageProps = {
  searchParams: Promise<{
    month?: string;
  }>;
};

function money(value: number | string | null | undefined) {
  return `৳${Number(value ?? 0).toLocaleString("en-BD")}`;
}

function todayInDhaka() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
  }).format(new Date());
}

function currentMonthInDhaka() {
  return todayInDhaka().slice(0, 7);
}

function startOfDhakaDateIso(dateString: string) {
  return new Date(`${dateString}T00:00:00+06:00`).toISOString();
}

function addDaysIso(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00+06:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function nextMonthStartDate(monthString: string) {
  const [yearText, monthText] = monthString.split("-");
  let year = Number(yearText);
  let month = Number(monthText);

  if (month === 12) {
    year += 1;
    month = 1;
  } else {
    month += 1;
  }

  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function sumRows(rows: any[], key: string) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function getSingleRelation(value: any) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function statusBadgeClass(status: string) {
  if (status === "paid" || status === "completed") {
    return "bg-green-100 text-green-700";
  }

  if (status === "partial" || status === "pending") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "cancelled") {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

function ReportCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

export default async function AdminReportsPage({
  searchParams,
}: ReportsPageProps) {
  await requireRole(["admin", "admin_doctor"]);

  const params = await searchParams;
  const selectedMonth = params?.month || currentMonthInDhaka();

  const supabase = await createClient();

  const today = todayInDhaka();
  const todayStartIso = startOfDhakaDateIso(today);
  const tomorrowStartIso = addDaysIso(today, 1);

  const monthStartDate = `${selectedMonth}-01`;
  const monthEndDate = nextMonthStartDate(selectedMonth);
  const monthStartIso = startOfDhakaDateIso(monthStartDate);
  const monthEndIso = startOfDhakaDateIso(monthEndDate);

  const [
    totalPatientsResult,
    todayAppointmentsResult,
    monthAppointmentsResult,
    todayPaymentsResult,
    monthPaymentsResult,
    dueInvoicesResult,
    monthInvoicesResult,
    monthAppointmentStatusResult,
    recentPaymentsResult,
    monthConsultationsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "patient"),

    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("appointment_date", today),

    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("appointment_date", monthStartDate)
      .lt("appointment_date", monthEndDate),

    supabase
      .from("payments")
      .select("amount, payment_method, created_at")
      .gte("created_at", todayStartIso)
      .lt("created_at", tomorrowStartIso),

    supabase
      .from("payments")
      .select("amount, payment_method, created_at")
      .gte("created_at", monthStartIso)
      .lt("created_at", monthEndIso),

    supabase
      .from("invoices")
      .select("due_amount, status")
      .in("status", ["unpaid", "partial"]),

    supabase
      .from("invoices")
      .select("total_amount, paid_amount, due_amount, status, doctors(name)")
      .gte("created_at", monthStartIso)
      .lt("created_at", monthEndIso)
      .neq("status", "cancelled"),

    supabase
      .from("appointments")
      .select("status")
      .gte("appointment_date", monthStartDate)
      .lt("appointment_date", monthEndDate),

    supabase
      .from("payments")
      .select(
        "amount, payment_method, transaction_reference, created_at, patient:profiles!payments_patient_id_fkey(full_name, phone), receiver:profiles!payments_received_by_fkey(full_name)"
      )
      .order("created_at", { ascending: false })
      .limit(10),

    supabase
      .from("consultations")
      .select("id")
      .gte("created_at", monthStartIso)
      .lt("created_at", monthEndIso),
  ]);

  const totalPatients = totalPatientsResult.count ?? 0;
  const todayAppointments = todayAppointmentsResult.count ?? 0;
  const monthAppointments = monthAppointmentsResult.count ?? 0;

  const todayPayments = todayPaymentsResult.data ?? [];
  const monthPayments = monthPaymentsResult.data ?? [];
  const dueInvoices = dueInvoicesResult.data ?? [];
  const monthInvoices = monthInvoicesResult.data ?? [];
  const monthAppointmentStatuses = monthAppointmentStatusResult.data ?? [];
  const recentPayments = recentPaymentsResult.data ?? [];
  const monthConsultations = monthConsultationsResult.data ?? [];

  const todayIncome = sumRows(todayPayments, "amount");
  const monthIncome = sumRows(monthPayments, "amount");
  const totalDue = sumRows(dueInvoices, "due_amount");
  const monthInvoiceValue = sumRows(monthInvoices, "total_amount");

  const monthConsultationIds = monthConsultations.map((item: any) => item.id);

  let consultationServices: any[] = [];

  if (monthConsultationIds.length > 0) {
    const { data } = await supabase
      .from("consultation_services")
      .select("service_name, price, tooth_number, consultation_id")
      .in("consultation_id", monthConsultationIds);

    consultationServices = data ?? [];
  }

  const doctorReportMap = new Map<
    string,
    {
      doctorName: string;
      invoiceCount: number;
      totalAmount: number;
      paidAmount: number;
      dueAmount: number;
    }
  >();

  for (const invoice of monthInvoices as any[]) {
    const doctor = getSingleRelation(invoice.doctors);
    const doctorName = doctor?.name ?? "Unknown Doctor";

    const existing = doctorReportMap.get(doctorName) ?? {
      doctorName,
      invoiceCount: 0,
      totalAmount: 0,
      paidAmount: 0,
      dueAmount: 0,
    };

    existing.invoiceCount += 1;
    existing.totalAmount += Number(invoice.total_amount ?? 0);
    existing.paidAmount += Number(invoice.paid_amount ?? 0);
    existing.dueAmount += Number(invoice.due_amount ?? 0);

    doctorReportMap.set(doctorName, existing);
  }

  const doctorReports = Array.from(doctorReportMap.values()).sort(
    (a, b) => b.paidAmount - a.paidAmount
  );

  const paymentMethodMap = new Map<
    string,
    {
      method: string;
      count: number;
      amount: number;
    }
  >();

  for (const payment of monthPayments as any[]) {
    const method = payment.payment_method ?? "unknown";

    const existing = paymentMethodMap.get(method) ?? {
      method,
      count: 0,
      amount: 0,
    };

    existing.count += 1;
    existing.amount += Number(payment.amount ?? 0);

    paymentMethodMap.set(method, existing);
  }

  const paymentMethodReports = Array.from(paymentMethodMap.values()).sort(
    (a, b) => b.amount - a.amount
  );

  const serviceReportMap = new Map<
    string,
    {
      serviceName: string;
      count: number;
      totalValue: number;
    }
  >();

  for (const item of consultationServices) {
    const serviceName = item.service_name ?? "Unknown Service";

    const existing = serviceReportMap.get(serviceName) ?? {
      serviceName,
      count: 0,
      totalValue: 0,
    };

    existing.count += 1;
    existing.totalValue += Number(item.price ?? 0);

    serviceReportMap.set(serviceName, existing);
  }

  const serviceReports = Array.from(serviceReportMap.values()).sort(
    (a, b) => b.totalValue - a.totalValue
  );

  const appointmentStatusMap = new Map<string, number>();

  for (const appointment of monthAppointmentStatuses as any[]) {
    const status = appointment.status ?? "unknown";
    appointmentStatusMap.set(status, (appointmentStatusMap.get(status) ?? 0) + 1);
  }

  const appointmentStatusReports = Array.from(appointmentStatusMap.entries()).map(
    ([status, count]) => ({
      status,
      count,
    })
  );

  const reportErrors = [
    totalPatientsResult.error?.message,
    todayAppointmentsResult.error?.message,
    monthAppointmentsResult.error?.message,
    todayPaymentsResult.error?.message,
    monthPaymentsResult.error?.message,
    dueInvoicesResult.error?.message,
    monthInvoicesResult.error?.message,
    monthAppointmentStatusResult.error?.message,
    recentPaymentsResult.error?.message,
    monthConsultationsResult.error?.message,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Admin Reports
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              View income, patients, appointments, due amount, doctor
              performance, service value, and payment method reports.
            </p>
          </div>

          <form className="flex items-end gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Report Month
              </label>
              <input
                name="month"
                type="month"
                defaultValue={selectedMonth}
                className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
              />
            </div>

            <button
              type="submit"
              className="rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white hover:bg-teal-700"
            >
              View
            </button>
          </form>
        </div>

        {reportErrors.length > 0 && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {reportErrors[0]}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReportCard
          title="Today’s Income"
          value={money(todayIncome)}
          subtitle={`Payments received today: ${today}`}
        />

        <ReportCard
          title="Monthly Income"
          value={money(monthIncome)}
          subtitle={`Payments received in ${selectedMonth}`}
        />

        <ReportCard
          title="Total Due"
          value={money(totalDue)}
          subtitle="Unpaid + partial invoices"
        />

        <ReportCard
          title="Total Patients"
          value={totalPatients}
          subtitle="Registered patient accounts"
        />

        <ReportCard
          title="Today’s Appointments"
          value={todayAppointments}
          subtitle={today}
        />

        <ReportCard
          title="Monthly Appointments"
          value={monthAppointments}
          subtitle={selectedMonth}
        />

        <ReportCard
          title="Monthly Invoice Value"
          value={money(monthInvoiceValue)}
          subtitle="Total invoice amount, not only paid"
        />

        <ReportCard
          title="Monthly Payments"
          value={monthPayments.length}
          subtitle="Number of payment entries"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Doctor-wise Report
          </h2>

          <div className="mt-5 overflow-x-auto rounded-xl border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3">Doctor</th>
                  <th className="p-3">Invoices</th>
                  <th className="p-3 text-right">Invoice Value</th>
                  <th className="p-3 text-right">Paid</th>
                  <th className="p-3 text-right">Due</th>
                </tr>
              </thead>

              <tbody>
                {doctorReports.length === 0 && (
                  <tr>
                    <td className="p-4 text-slate-600" colSpan={5}>
                      No doctor report found for this month.
                    </td>
                  </tr>
                )}

                {doctorReports.map((row) => (
                  <tr key={row.doctorName} className="border-t">
                    <td className="p-3 font-semibold text-slate-900">
                      {row.doctorName}
                    </td>
                    <td className="p-3">{row.invoiceCount}</td>
                    <td className="p-3 text-right">
                      {money(row.totalAmount)}
                    </td>
                    <td className="p-3 text-right text-green-700">
                      {money(row.paidAmount)}
                    </td>
                    <td className="p-3 text-right text-red-700">
                      {money(row.dueAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Payment Method Report
          </h2>

          <div className="mt-5 overflow-x-auto rounded-xl border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3">Method</th>
                  <th className="p-3">Payments</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>

              <tbody>
                {paymentMethodReports.length === 0 && (
                  <tr>
                    <td className="p-4 text-slate-600" colSpan={3}>
                      No payment found for this month.
                    </td>
                  </tr>
                )}

                {paymentMethodReports.map((row) => (
                  <tr key={row.method} className="border-t">
                    <td className="p-3 font-semibold capitalize text-slate-900">
                      {row.method.replace("_", " ")}
                    </td>
                    <td className="p-3">{row.count}</td>
                    <td className="p-3 text-right font-semibold text-slate-900">
                      {money(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Service-wise Treatment Value
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            This is based on consultation service value, not necessarily paid
            amount.
          </p>

          <div className="mt-5 overflow-x-auto rounded-xl border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3">Service</th>
                  <th className="p-3">Count</th>
                  <th className="p-3 text-right">Value</th>
                </tr>
              </thead>

              <tbody>
                {serviceReports.length === 0 && (
                  <tr>
                    <td className="p-4 text-slate-600" colSpan={3}>
                      No service report found for this month.
                    </td>
                  </tr>
                )}

                {serviceReports.map((row) => (
                  <tr key={row.serviceName} className="border-t">
                    <td className="p-3 font-semibold text-slate-900">
                      {row.serviceName}
                    </td>
                    <td className="p-3">{row.count}</td>
                    <td className="p-3 text-right font-semibold text-slate-900">
                      {money(row.totalValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Appointment Status Report
          </h2>

          <div className="mt-5 overflow-x-auto rounded-xl border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Count</th>
                </tr>
              </thead>

              <tbody>
                {appointmentStatusReports.length === 0 && (
                  <tr>
                    <td className="p-4 text-slate-600" colSpan={2}>
                      No appointment found for this month.
                    </td>
                  </tr>
                )}

                {appointmentStatusReports.map((row) => (
                  <tr key={row.status} className="border-t">
                    <td className="p-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusBadgeClass(
                          row.status
                        )}`}
                      >
                        {row.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {row.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Recent Payments
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Latest 10 payment entries.
            </p>
          </div>

          <Link
            href="/dashboard/admin/appointments"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            View Appointments
          </Link>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Patient</th>
                <th className="p-3">Method</th>
                <th className="p-3">Reference</th>
                <th className="p-3">Received By</th>
                <th className="p-3 text-right">Amount</th>
              </tr>
            </thead>

            <tbody>
              {recentPayments.length === 0 && (
                <tr>
                  <td className="p-4 text-slate-600" colSpan={6}>
                    No recent payment found.
                  </td>
                </tr>
              )}

              {recentPayments.map((payment: any) => {
                const patient = getSingleRelation(payment.patient);
                const receiver = getSingleRelation(payment.receiver);

                return (
                  <tr key={`${payment.created_at}-${payment.amount}`} className="border-t">
                    <td className="p-3">
                      {payment.created_at
                        ? new Date(payment.created_at).toLocaleString()
                        : "-"}
                    </td>

                    <td className="p-3">
                      <p className="font-semibold text-slate-900">
                        {patient?.full_name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {patient?.phone ?? "-"}
                      </p>
                    </td>

                    <td className="p-3 capitalize">
                      {payment.payment_method?.replace("_", " ") ?? "-"}
                    </td>

                    <td className="p-3">
                      {payment.transaction_reference ?? "-"}
                    </td>

                    <td className="p-3">
                      {receiver?.full_name ?? "-"}
                    </td>

                    <td className="p-3 text-right font-semibold text-slate-900">
                      {money(payment.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}