import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";
import type { DentalService } from "@/types/app";
import {
  createServiceAction,
  deleteServiceAction,
  updateServiceAction,
} from "./actions";

type AdminServicesPageProps = {
  searchParams: Promise<{
    message?: string;
    error?: string;
  }>;
};

export default async function AdminServicesPage({
  searchParams,
}: AdminServicesPageProps) {
  await requireRole(["admin", "admin_doctor"]);

  const params = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("created_at", { ascending: false });

  const services = (data ?? []) as DentalService[];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          Manage Dental Services
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Add services such as scaling, filling, root canal, extraction, crown,
          whitening, and other treatments. These prices will later be used in
          doctor consultation and agreement generation.
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
        <h2 className="text-lg font-bold text-slate-900">Add New Service</h2>

        <form action={createServiceAction} className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Service Name
            </label>
            <input
              name="name"
              required
              placeholder="Root Canal Treatment"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Slug
            </label>
            <input
              name="slug"
              placeholder="root-canal-treatment"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Category
            </label>
            <input
              name="category"
              placeholder="Endodontics"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Base Price
            </label>
            <input
              name="base_price"
              type="number"
              min={0}
              step="1"
              defaultValue={0}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Short explanation of this service"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              name="is_tooth_based"
              type="checkbox"
              defaultChecked
              className="h-4 w-4"
            />
            Tooth-based service
          </label>

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
              Add Service
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">All Services</h2>

        <div className="mt-5 space-y-4">
          {services.length === 0 && (
            <p className="text-sm text-slate-600">No services found.</p>
          )}

          {services.map((service) => (
            <div key={service.id} className="rounded-xl border p-4">
              <form
                action={updateServiceAction}
                className="grid gap-4 md:grid-cols-2"
              >
                <input type="hidden" name="service_id" value={service.id} />

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Service Name
                  </label>
                  <input
                    name="name"
                    defaultValue={service.name}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Slug
                  </label>
                  <input
                    name="slug"
                    defaultValue={service.slug}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Category
                  </label>
                  <input
                    name="category"
                    defaultValue={service.category ?? ""}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Base Price
                  </label>
                  <input
                    name="base_price"
                    type="number"
                    min={0}
                    step="1"
                    defaultValue={service.base_price}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">
                    Description
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={service.description ?? ""}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    name="is_tooth_based"
                    type="checkbox"
                    defaultChecked={service.is_tooth_based}
                    className="h-4 w-4"
                  />
                  Tooth-based
                </label>

                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    name="is_active"
                    type="checkbox"
                    defaultChecked={service.is_active}
                    className="h-4 w-4"
                  />
                  Active
                </label>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700"
                  >
                    Update Service
                  </button>
                </div>
              </form>

              <form action={deleteServiceAction} className="mt-3">
                <input type="hidden" name="service_id" value={service.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  Delete Service
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}