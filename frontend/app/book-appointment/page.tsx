import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";
import AppointmentBookingForm from "@/components/appointments/AppointmentBookingForm";
import type { Doctor } from "@/types/app";

type BookAppointmentPageProps = {
  searchParams: Promise<{
    message?: string;
    error?: string;
  }>;
};

export default async function BookAppointmentPage({
  searchParams,
}: BookAppointmentPageProps) {
  await requireRole(["patient"]);

  const params = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("doctors")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  const doctors = (data ?? []) as Doctor[];

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-sm font-semibold text-teal-700">
              ← Back to Dashboard
            </Link>

            <h1 className="mt-4 text-2xl font-bold text-slate-900">
              Book Appointment
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Select doctor, date, and available time slot.
            </p>
          </div>
        </div>

        {params?.message && (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {params.message}
          </div>
        )}

        {params?.error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {params.error}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </div>
        )}

        {doctors.length === 0 ? (
          <p className="mt-6 text-sm text-red-600">
            No active doctor found. Please contact the clinic.
          </p>
        ) : (
          <div className="mt-6">
            <AppointmentBookingForm doctors={doctors} />
          </div>
        )}
      </div>
    </main>
  );
}