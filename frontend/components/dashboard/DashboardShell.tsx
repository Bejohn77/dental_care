import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";
import type { Profile } from "@/types/app";

type DashboardShellProps = {
  profile: Profile;
  children: React.ReactNode;
};

export default function DashboardShell({
  profile,
  children,
}: DashboardShellProps) {
  const navItems = getNavItems(profile.role);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <Link href="/dashboard" className="text-xl font-bold text-teal-700">
              Medico Dental Care
            </Link>
            <p className="text-xs text-slate-500">Management Portal</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">
                {profile.full_name}
              </p>
              <p className="text-xs capitalize text-slate-500">
                {profile.role.replace("_", " ")}
              </p>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[240px_1fr]">
        <aside className="rounded-2xl bg-white p-4 shadow-sm">
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <section>{children}</section>
      </div>
    </div>
  );
}

function getNavItems(role: Profile["role"]) {
  const common = [{ label: "Dashboard", href: "/dashboard" }];

  if (role === "patient") {
    return [
      ...common,
      { label: "Book Appointment", href: "/book-appointment" },
      { label: "My Appointments", href: "/dashboard/patient" },
    ];
  }

  if (role === "compounder") {
    return [
      ...common,
      { label: "Today’s Patients", href: "/dashboard/compounder" },
    ];
  }

  if (role === "doctor") {
    return [
      ...common,
      { label: "Doctor Portal", href: "/dashboard/doctor" },
      { label: "My Patients", href: "/dashboard/doctor/patients" },
    ];
  }

  if (role === "admin") {
    return [
      ...common,
      { label: "Admin Panel", href: "/dashboard/admin" },
      { label: "Reports", href: "/dashboard/admin/reports" },
      { label: "Patients", href: "/dashboard/admin/patients" },
      { label: "Services", href: "/dashboard/admin/services" },
      { label: "Doctors", href: "/dashboard/admin/doctors" },
      { label: "Schedules", href: "/dashboard/admin/schedules" },
      { label: "Appointments", href: "/dashboard/admin/appointments" },
    ];
  }

  if (role === "admin_doctor") {
    return [
      ...common,
      { label: "Admin Panel", href: "/dashboard/admin" },
      { label: "Reports", href: "/dashboard/admin/reports" },
      { label: "Patients", href: "/dashboard/admin/patients" },
      { label: "Services", href: "/dashboard/admin/services" },
      { label: "Doctors", href: "/dashboard/admin/doctors" },
      { label: "Schedules", href: "/dashboard/admin/schedules" },
      { label: "Appointments", href: "/dashboard/admin/appointments" },
      { label: "Doctor Portal", href: "/dashboard/doctor" },
      { label: "My Patients", href: "/dashboard/doctor/patients" },
    ];
  }

  return common;
}