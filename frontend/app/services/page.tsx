import Link from "next/link";
import { createClient } from "@/lib/db/mongodb";
import type { DentalService } from "@/types/app";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  const services = (data ?? []) as DentalService[];

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm font-semibold text-teal-700">
              ← Back to Home
            </Link>

            <h1 className="mt-4 text-4xl font-bold text-slate-950">
              Dental Services
            </h1>

            <p className="mt-3 max-w-2xl text-slate-600">
              Explore available dental services at Medico Dental Care. Final
              price may vary depending on doctor consultation and clinical
              condition.
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
          {services.length === 0 && (
            <p className="text-slate-600">No active services found.</p>
          )}

          {services.map((service) => (
            <article
              key={service.id}
              className="rounded-2xl bg-white p-6 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                {service.category ?? "Dental Service"}
              </p>

              <h2 className="mt-2 text-xl font-bold text-slate-900">
                {service.name}
              </h2>

              <p className="mt-3 text-sm text-slate-600">
                {service.description ?? "Details will be explained by doctor."}
              </p>

              <div className="mt-5 flex items-center justify-between">
                <p className="font-bold text-slate-900">
                  ৳{Number(service.base_price).toLocaleString("en-BD")}
                </p>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {service.is_tooth_based ? "Tooth based" : "General"}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}