import Link from "next/link";
import { createClient } from "@/lib/db/mongodb";
import type { Doctor } from "@/types/app";

export const dynamic = "force-dynamic";

export default async function DoctorsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("doctors")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  const doctors = (data ?? []) as Doctor[];

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm font-semibold text-teal-700">
              ← Back to Home
            </Link>

            <h1 className="mt-4 text-4xl font-bold text-slate-950">
              Our Doctors
            </h1>

            <p className="mt-3 max-w-2xl text-slate-600">
              Meet the doctors of Medico Dental Care. Patients can book
              appointments with available doctors in the next phase.
            </p>
          </div>

          <Link
            href="/book-appointment"
            className="hidden rounded-lg bg-teal-600 px-5 py-3 font-semibold text-white hover:bg-teal-700 md:inline-block"
          >
            Book Appointment
          </Link>
        </div>

        {error && (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error.message}
          </div>
        )}

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {doctors.length === 0 && (
            <p className="text-slate-600">No active doctors found.</p>
          )}

          {doctors.map((doctor) => (
            <article
              key={doctor.id}
              className="rounded-2xl bg-white p-6 shadow-sm"
            >
              {doctor.photo_url ? (
                <img
                  src={doctor.photo_url}
                  alt={doctor.name}
                  className="h-44 w-full rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-44 w-full items-center justify-center rounded-xl bg-teal-50 text-4xl font-bold text-teal-700">
                  {doctor.name.charAt(0)}
                </div>
              )}

              <h2 className="mt-5 text-xl font-bold text-slate-900">
                {doctor.name}
              </h2>

              <p className="mt-1 text-sm font-medium text-teal-700">
                {doctor.designation ?? "Dental Surgeon"}
              </p>

              <p className="mt-1 text-sm text-slate-600">
                {doctor.speciality ?? "General Dentistry"}
              </p>

              <p className="mt-4 text-sm text-slate-600">
                {doctor.bio ?? "Doctor profile will be updated soon."}
              </p>

              <div className="mt-5 rounded-lg bg-slate-50 p-3">
                <p className="text-sm text-slate-500">Consultation Fee</p>
                <p className="font-bold text-slate-900">
                  ৳{Number(doctor.consultation_fee).toLocaleString("en-BD")}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}