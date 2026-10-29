import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";
import type { Doctor, DoctorSchedule } from "@/types/app";
import {
  createScheduleAction,
  deleteScheduleAction,
  updateScheduleAction,
} from "./actions";

type ScheduleWithDoctor = DoctorSchedule & {
  doctors?: {
    name: string;
  } | null;
};

type AdminSchedulesPageProps = {
  searchParams: Promise<{
    message?: string;
    error?: string;
  }>;
};

const days = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

function getDayName(day: number) {
  return days.find((item) => item.value === day)?.label ?? "Unknown";
}

function shortTime(time: string) {
  return time.slice(0, 5);
}

export default async function AdminSchedulesPage({
  searchParams,
}: AdminSchedulesPageProps) {
  await requireRole(["admin", "admin_doctor"]);

  const params = await searchParams;
  const supabase = await createClient();

  const { data: doctorsData } = await supabase
    .from("doctors")
    .select("*")
    .order("name", { ascending: true });

  const doctors = (doctorsData ?? []) as Doctor[];

  const { data: schedulesData, error } = await supabase
    .from("doctor_schedules")
    .select("*, doctors(name)")
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  const schedules = (schedulesData ?? []) as ScheduleWithDoctor[];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          Manage Doctor Schedules
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Create doctor availability. Patients will only see available slots
          based on these schedules.
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
        <h2 className="text-lg font-bold text-slate-900">Add New Schedule</h2>

        {doctors.length === 0 ? (
          <p className="mt-4 text-sm text-red-600">
            Please add a doctor first from Admin → Doctors.
          </p>
        ) : (
          <form action={createScheduleAction} className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Doctor
              </label>
              <select
                name="doctor_id"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
              >
                <option value="">Select Doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Day</label>
              <select
                name="day_of_week"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
              >
                {days.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Start Time
              </label>
              <input
                name="start_time"
                type="time"
                required
                defaultValue="09:00"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                End Time
              </label>
              <input
                name="end_time"
                type="time"
                required
                defaultValue="17:00"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Slot Minutes
              </label>
              <input
                name="slot_minutes"
                type="number"
                min={5}
                max={180}
                defaultValue={30}
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
                Add Schedule
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">All Schedules</h2>

        <div className="mt-5 space-y-4">
          {schedules.length === 0 && (
            <p className="text-sm text-slate-600">No schedules found.</p>
          )}

          {schedules.map((schedule) => (
            <div key={schedule.id} className="rounded-xl border p-4">
              <p className="mb-4 text-sm font-semibold text-slate-900">
                {schedule.doctors?.name ?? "Unknown Doctor"} —{" "}
                {getDayName(schedule.day_of_week)} —{" "}
                {shortTime(schedule.start_time)} to {shortTime(schedule.end_time)}
              </p>

              <form
                action={updateScheduleAction}
                className="grid gap-4 md:grid-cols-2"
              >
                <input type="hidden" name="schedule_id" value={schedule.id} />

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Doctor
                  </label>
                  <select
                    name="doctor_id"
                    defaultValue={schedule.doctor_id}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  >
                    {doctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Day
                  </label>
                  <select
                    name="day_of_week"
                    defaultValue={schedule.day_of_week}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  >
                    {days.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Start Time
                  </label>
                  <input
                    name="start_time"
                    type="time"
                    defaultValue={shortTime(schedule.start_time)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    End Time
                  </label>
                  <input
                    name="end_time"
                    type="time"
                    defaultValue={shortTime(schedule.end_time)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Slot Minutes
                  </label>
                  <input
                    name="slot_minutes"
                    type="number"
                    min={5}
                    max={180}
                    defaultValue={schedule.slot_minutes}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    name="is_active"
                    type="checkbox"
                    defaultChecked={schedule.is_active}
                    className="h-4 w-4"
                  />
                  Active
                </label>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700"
                  >
                    Update Schedule
                  </button>
                </div>
              </form>

              <form action={deleteScheduleAction} className="mt-3">
                <input type="hidden" name="schedule_id" value={schedule.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  Delete Schedule
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}