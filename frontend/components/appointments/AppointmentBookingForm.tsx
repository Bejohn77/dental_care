"use client";

import { useEffect, useMemo, useState } from "react";
import { createAppointmentAction } from "@/app/book-appointment/actions";
import type { AvailableSlot, Doctor } from "@/types/app";

type AppointmentBookingFormProps = {
  doctors: Doctor[];
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function AppointmentBookingForm({
  doctors,
}: AppointmentBookingFormProps) {
  const [doctorId, setDoctorId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(todayDate());
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState("");

  const selectedDoctor = useMemo(() => {
    return doctors.find((doctor) => doctor.id === doctorId) ?? null;
  }, [doctors, doctorId]);

  useEffect(() => {
    async function loadSlots() {
      setSelectedTime("");
      setSlotError("");
      setSlots([]);

      if (!doctorId || !appointmentDate) return;

      setLoadingSlots(true);

      try {
        const query = new URLSearchParams({
          doctorId,
          date: appointmentDate,
        });
        const response = await fetch(`/api/available-slots?${query}`);
        const result = (await response.json()) as {
          slots?: AvailableSlot[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error ?? "Could not load time slots.");
        }
        setSlots(result.slots ?? []);
      } catch (error) {
        setSlotError(
          error instanceof Error ? error.message : "Could not load time slots."
        );
      } finally {
        setLoadingSlots(false);
      }
    }

    loadSlots();
  }, [doctorId, appointmentDate]);

  return (
    <form action={createAppointmentAction} className="space-y-5">
      <input type="hidden" name="start_time" value={selectedTime} />

      <div>
        <label className="text-sm font-medium text-slate-700">
          Select Doctor
        </label>
        <select
          name="doctor_id"
          required
          value={doctorId}
          onChange={(event) => setDoctorId(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
        >
          <option value="">Select Doctor</option>
          {doctors.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.name} — {doctor.speciality ?? "Dental Surgeon"}
            </option>
          ))}
        </select>
      </div>

      {selectedDoctor && (
        <div className="rounded-xl bg-teal-50 p-4">
          <p className="font-semibold text-slate-900">{selectedDoctor.name}</p>
          <p className="mt-1 text-sm text-slate-600">
            {selectedDoctor.designation ?? "Dental Surgeon"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {selectedDoctor.speciality ?? "General Dentistry"}
          </p>
          <p className="mt-2 text-sm font-semibold text-teal-700">
            Consultation Fee: ৳
            {Number(selectedDoctor.consultation_fee).toLocaleString("en-BD")}
          </p>
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-slate-700">
          Appointment Date
        </label>
        <input
          name="appointment_date"
          type="date"
          required
          min={todayDate()}
          value={appointmentDate}
          onChange={(event) => setAppointmentDate(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
        />
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700">
          Available Time Slots
        </p>

        {!doctorId && (
          <p className="mt-2 text-sm text-slate-500">
            Please select a doctor first.
          </p>
        )}

        {doctorId && loadingSlots && (
          <p className="mt-2 text-sm text-slate-500">Loading available slots...</p>
        )}

        {slotError && (
          <p className="mt-2 text-sm text-red-600">{slotError}</p>
        )}

        {doctorId && !loadingSlots && slots.length === 0 && !slotError && (
          <p className="mt-2 text-sm text-red-600">
            No available slot found for this date. Please choose another date.
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {slots.map((slot) => {
            const selected = selectedTime === slot.start_time;

            return (
              <button
                key={slot.start_time}
                type="button"
                onClick={() => setSelectedTime(slot.start_time)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                  selected
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {slot.start_time}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">
          Reason for Visit
        </label>
        <textarea
          name="reason"
          rows={4}
          placeholder="Example: Tooth pain, scaling, filling, gum bleeding..."
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
        />
      </div>

      <button
        type="submit"
        disabled={!doctorId || !appointmentDate || !selectedTime}
        className="w-full rounded-lg bg-teal-600 px-5 py-3 font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        Confirm Appointment
      </button>
    </form>
  );
}