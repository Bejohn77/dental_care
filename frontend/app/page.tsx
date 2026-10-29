import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
            Medico Dental Care
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 md:text-6xl">
            Professional Dental Care and Clinic Management System
          </h1>

          <p className="mt-6 text-lg text-slate-600">
            Patients can book appointments, doctors can manage consultations,
            and the clinic can generate treatment agreements with digital
            signatures.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
  href="/book-appointment"
  className="rounded-lg bg-teal-600 px-5 py-3 font-semibold text-white hover:bg-teal-700"
>
  Book Appointment
</Link>

            <Link
              href="/login"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 hover:bg-slate-100"
            >
              Login
            </Link>
            <Link
  href="/services"
  className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 hover:bg-slate-100"
>
  View Services
</Link>

<Link
  href="/doctors"
  className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 hover:bg-slate-100"
>
  View Doctors
</Link>
          </div>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-bold text-slate-900">Dental Services</h2>
            <p className="mt-2 text-sm text-slate-600">
              Scaling, filling, extraction, root canal, crown, bridge, whitening,
              implant consultation, and more.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-bold text-slate-900">Doctor Appointment</h2>
            <p className="mt-2 text-sm text-slate-600">
              Patients can log in, select doctor, view available time, and book
              appointment.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-bold text-slate-900">Agreement Generation</h2>
            <p className="mt-2 text-sm text-slate-600">
              Doctor selects tooth and service, then the system generates
              agreement with digital signature.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}