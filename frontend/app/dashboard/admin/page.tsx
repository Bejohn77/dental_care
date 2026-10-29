import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";

function money(value: number | string | null | undefined) {
  return `৳${Number(value ?? 0).toLocaleString("en-BD")}`;
}

function todayInDhaka() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
  }).format(new Date());
}

function startOfDhakaDateIso(dateString: string) {
  return new Date(`${dateString}T00:00:00+06:00`).toISOString();
}

function addDaysIso(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00+06:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function sumRows(rows: any[], key: string) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function AdminCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const profile = await requireRole(["admin", "admin_doctor"]);

  const supabase = await createClient();

  const today = todayInDhaka();
  const todayStartIso = startOfDhakaDateIso(today);
  const tomorrowStartIso = addDaysIso(today, 1);

  const [
    patientsResult,
    todayAppointmentsResult,
    todayPaymentsResult,
    dueInvoicesResult,
    pendingAppointmentsResult,
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
      .from("payments")
      .select("amount")
      .gte("created_at", todayStartIso)
      .lt("created_at", tomorrowStartIso),

    supabase
      .from("invoices")
      .select("due_amount")
      .in("status", ["unpaid", "partial"]),

    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const totalPatients = patientsResult.count ?? 0;
  const todayAppointments = todayAppointmentsResult.count ?? 0;
  const todayIncome = sumRows(todayPaymentsResult.data ?? [], "amount");
  const totalDue = sumRows(dueInvoicesResult.data ?? [], "due_amount");
  const pendingAppointments = pendingAppointmentsResult.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>

            <p className="mt-2 text-slate-600">
              Welcome, {profile.full_name}. Manage doctors, services,
              appointments, schedules, patients, invoices, payments, and
              reports.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/admin/patients"
              className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Patient Records
            </Link>

            <Link
              href="/dashboard/admin/reports"
              className="rounded-lg bg-teal-600 px-5 py-2.5 font-semibold text-white hover:bg-teal-700"
            >
              View Full Reports
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AdminCard
          title="Total Patients"
          value={totalPatients}
          subtitle="Registered patients"
        />

        <AdminCard
          title="Today’s Appointments"
          value={todayAppointments}
          subtitle={today}
        />

        <AdminCard
          title="Today’s Income"
          value={money(todayIncome)}
          subtitle="Payment received today"
        />

        <AdminCard
          title="Total Due"
          value={money(totalDue)}
          subtitle="Unpaid + partial invoices"
        />

        <AdminCard
          title="Pending Appointments"
          value={pendingAppointments}
          subtitle="Waiting for confirmation"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/dashboard/admin/patients"
          className="rounded-2xl bg-white p-6 shadow-sm hover:bg-teal-50"
        >
          <h2 className="font-bold text-slate-900">Patient Records</h2>
          <p className="mt-2 text-sm text-slate-600">
            Search patients and open full clinical, agreement, invoice, and
            payment history.
          </p>
        </Link>

        <Link
          href="/dashboard/admin/services"
          className="rounded-2xl bg-white p-6 shadow-sm hover:bg-teal-50"
        >
          <h2 className="font-bold text-slate-900">Manage Services</h2>
          <p className="mt-2 text-sm text-slate-600">
            Add, update, activate, or deactivate dental services and prices.
          </p>
        </Link>

        <Link
          href="/dashboard/admin/doctors"
          className="rounded-2xl bg-white p-6 shadow-sm hover:bg-teal-50"
        >
          <h2 className="font-bold text-slate-900">Manage Doctors</h2>
          <p className="mt-2 text-sm text-slate-600">
            Add doctors, update profiles, and link doctor login accounts.
          </p>
        </Link>

        <Link
          href="/dashboard/admin/schedules"
          className="rounded-2xl bg-white p-6 shadow-sm hover:bg-teal-50"
        >
          <h2 className="font-bold text-slate-900">Doctor Schedules</h2>
          <p className="mt-2 text-sm text-slate-600">
            Manage doctor availability and appointment slots.
          </p>
        </Link>

        <Link
          href="/dashboard/admin/appointments"
          className="rounded-2xl bg-white p-6 shadow-sm hover:bg-teal-50"
        >
          <h2 className="font-bold text-slate-900">Appointments</h2>
          <p className="mt-2 text-sm text-slate-600">
            View all patient appointments and update appointment status.
          </p>
        </Link>

        <Link
          href="/dashboard/admin/reports"
          className="rounded-2xl bg-white p-6 shadow-sm hover:bg-teal-50"
        >
          <h2 className="font-bold text-slate-900">Reports</h2>
          <p className="mt-2 text-sm text-slate-600">
            Income, due, patients, doctors, services, and payment reports.
          </p>
        </Link>
      </div>
    </div>
  );
}