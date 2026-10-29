import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";
import type { Doctor } from "@/types/app";
import {
  createDoctorAction,
  deleteDoctorAction,
  updateDoctorAction,
} from "./actions";

type AdminDoctorsPageProps = {
  searchParams: Promise<{
    message?: string;
    error?: string;
  }>;
};

export default async function AdminDoctorsPage({
  searchParams,
}: AdminDoctorsPageProps) {
  await requireRole(["admin", "admin_doctor"]);

  const params = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("doctors")
    .select("*")
    .order("created_at", { ascending: false });

  const doctors = (data ?? []) as Doctor[];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Manage Doctors</h1>

        <p className="mt-2 text-sm text-slate-600">
          Add and manage doctors for the public website and future appointment
          booking. Doctor login account connection will be added later.
        </p>

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
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Add New Doctor</h2>

        <form action={createDoctorAction} className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Doctor Name
            </label>
            <input
              name="name"
              required
              placeholder="Dr. Rahim Ahmed"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Designation
            </label>
            <input
              name="designation"
              placeholder="BDS, FCPS"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Speciality
            </label>
            <input
              name="speciality"
              placeholder="Root Canal Specialist"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Consultation Fee
            </label>
            <input
              name="consultation_fee"
              type="number"
              min={0}
              step="1"
              defaultValue={0}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              name="email"
              type="email"
              placeholder="doctor@email.com"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Phone</label>
            <input
              name="phone"
              placeholder="01XXXXXXXXX"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700">
              Photo URL
            </label>
            <input
              name="photo_url"
              placeholder="https://example.com/doctor.jpg"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Bio</label>
            <textarea
              name="bio"
              rows={3}
              placeholder="Short profile of the doctor"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              name="is_active"
              type="checkbox"
              defaultChecked
              className="h-4 w-4"
            />
            Active
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-teal-600 px-5 py-2.5 font-semibold text-white hover:bg-teal-700"
            >
              Add Doctor
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">All Doctors</h2>

        <div className="mt-5 space-y-4">
          {doctors.length === 0 && (
            <p className="text-sm text-slate-600">No doctors found.</p>
          )}

          {doctors.map((doctor) => (
            <div key={doctor.id} className="rounded-xl border p-4">
              <form
                action={updateDoctorAction}
                className="grid gap-4 md:grid-cols-2"
              >
                <input type="hidden" name="doctor_id" value={doctor.id} />

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Doctor Name
                  </label>
                  <input
                    name="name"
                    defaultValue={doctor.name}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Designation
                  </label>
                  <input
                    name="designation"
                    defaultValue={doctor.designation ?? ""}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Speciality
                  </label>
                  <input
                    name="speciality"
                    defaultValue={doctor.speciality ?? ""}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Consultation Fee
                  </label>
                  <input
                    name="consultation_fee"
                    type="number"
                    min={0}
                    step="1"
                    defaultValue={doctor.consultation_fee}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={doctor.email ?? ""}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Phone
                  </label>
                  <input
                    name="phone"
                    defaultValue={doctor.phone ?? ""}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">
                    Photo URL
                  </label>
                  <input
                    name="photo_url"
                    defaultValue={doctor.photo_url ?? ""}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">
                    Bio
                  </label>
                  <textarea
                    name="bio"
                    rows={3}
                    defaultValue={doctor.bio ?? ""}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    name="is_active"
                    type="checkbox"
                    defaultChecked={doctor.is_active}
                    className="h-4 w-4"
                  />
                  Active
                </label>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700"
                  >
                    Update Doctor
                  </button>
                </div>
              </form>

              <form action={deleteDoctorAction} className="mt-3">
                <input type="hidden" name="doctor_id" value={doctor.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  Delete Doctor
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}