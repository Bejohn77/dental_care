"use client";

import { useMemo, useState } from "react";
import ToothChart from "@/components/dental/ToothChart";
import type {
  Consultation,
  ConsultationService,
  DentalService,
} from "@/types/app";
import { saveConsultationAction } from "@/app/dashboard/doctor/consultation/[appointmentId]/actions";

type TreatmentItem = {
  tooth_number: string | null;
  service_id: string;
  service_name: string;
  price: number;
  note: string;
};

type ConsultationFormProps = {
  appointmentId: string;
  services: DentalService[];
  existingConsultation: Consultation | null;
  existingItems: ConsultationService[];
};

export default function ConsultationForm({
  appointmentId,
  services,
  existingConsultation,
  existingItems,
}: ConsultationFormProps) {
  const [selectedTeeth, setSelectedTeeth] = useState<string[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [itemNote, setItemNote] = useState("");

  const [items, setItems] = useState<TreatmentItem[]>(
    existingItems
      .filter((item) => item.service_id)
      .map((item) => ({
        tooth_number: item.tooth_number,
        service_id: item.service_id as string,
        service_name: item.service_name,
        price: Number(item.price),
        note: item.note ?? "",
      }))
  );

  const selectedService = useMemo(() => {
    return services.find((service) => service.id === selectedServiceId) ?? null;
  }, [services, selectedServiceId]);

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item.price), 0);
  }, [items]);

  function addTreatmentItem() {
    if (!selectedService) {
      alert("Please select a service first.");
      return;
    }

    if (selectedService.is_tooth_based && selectedTeeth.length === 0) {
      alert("Please select at least one tooth for this service.");
      return;
    }

    if (selectedService.is_tooth_based) {
      const newItems = selectedTeeth.map((tooth) => ({
        tooth_number: tooth,
        service_id: selectedService.id,
        service_name: selectedService.name,
        price: Number(selectedService.base_price),
        note: itemNote,
      }));

      setItems((previousItems) => [...previousItems, ...newItems]);
      setSelectedTeeth([]);
      setItemNote("");
      return;
    }

    setItems((previousItems) => [
      ...previousItems,
      {
        tooth_number: null,
        service_id: selectedService.id,
        service_name: selectedService.name,
        price: Number(selectedService.base_price),
        note: itemNote,
      },
    ]);

    setItemNote("");
  }

  function removeItem(index: number) {
    setItems((previousItems) =>
      previousItems.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  const itemsForServer = items.map((item) => ({
    tooth_number: item.tooth_number,
    service_id: item.service_id,
    note: item.note,
  }));

  return (
    <form action={saveConsultationAction} className="space-y-6">
      <input type="hidden" name="appointment_id" value={appointmentId} />
      <input
        type="hidden"
        name="consultation_items"
        value={JSON.stringify(itemsForServer)}
      />

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">
          Diagnosis & Treatment Plan
        </h2>

        <div className="mt-5 grid gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Diagnosis
            </label>
            <textarea
              name="diagnosis"
              rows={3}
              defaultValue={existingConsultation?.diagnosis ?? ""}
              placeholder="Example: Deep caries, irreversible pulpitis, gingivitis..."
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Treatment Plan
            </label>
            <textarea
              name="treatment_plan"
              rows={3}
              defaultValue={existingConsultation?.treatment_plan ?? ""}
              placeholder="Example: RCT followed by crown, scaling, filling..."
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Doctor Notes
            </label>
            <textarea
              name="doctor_notes"
              rows={3}
              defaultValue={existingConsultation?.doctor_notes ?? ""}
              placeholder="Internal clinical notes"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">
          Tooth & Service Selection
        </h2>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
          <ToothChart
            selectedTeeth={selectedTeeth}
            onChange={setSelectedTeeth}
          />

          <div className="rounded-2xl border p-4">
            <h3 className="font-bold text-slate-900">Add Treatment Item</h3>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Service
                </label>
                <select
                  value={selectedServiceId}
                  onChange={(event) => setSelectedServiceId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                >
                  <option value="">Select service</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} — ৳
                      {Number(service.base_price).toLocaleString("en-BD")}
                    </option>
                  ))}
                </select>
              </div>

              {selectedService && (
                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-900">
                    {selectedService.name}
                  </p>
                  <p className="mt-1 text-slate-600">
                    Price: ৳
                    {Number(selectedService.base_price).toLocaleString("en-BD")}
                  </p>
                  <p className="mt-1 text-slate-600">
                    Type:{" "}
                    {selectedService.is_tooth_based
                      ? "Tooth-based"
                      : "General service"}
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Item Note
                </label>
                <textarea
                  value={itemNote}
                  onChange={(event) => setItemNote(event.target.value)}
                  rows={3}
                  placeholder="Optional note for this selected item"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-600"
                />
              </div>

              <button
                type="button"
                onClick={addTreatmentItem}
                className="w-full rounded-lg bg-teal-600 px-4 py-2.5 font-semibold text-white hover:bg-teal-700"
              >
                Add Selected Service
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Selected Treatment Items
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              These items will be saved and later used for agreement and
              invoice generation.
            </p>
          </div>

          <div className="rounded-xl bg-teal-50 px-5 py-3">
            <p className="text-xs font-semibold uppercase text-teal-700">
              Total Amount
            </p>
            <p className="text-2xl font-bold text-teal-800">
              ৳{totalAmount.toLocaleString("en-BD")}
            </p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">Tooth</th>
                <th className="p-3">Service</th>
                <th className="p-3">Note</th>
                <th className="p-3">Price</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>

            <tbody>
              {items.length === 0 && (
                <tr>
                  <td className="p-4 text-slate-600" colSpan={5}>
                    No treatment item added yet.
                  </td>
                </tr>
              )}

              {items.map((item, index) => (
                <tr key={`${item.service_id}-${item.tooth_number}-${index}`} className="border-t">
                  <td className="p-3 font-semibold text-slate-900">
                    {item.tooth_number ?? "General"}
                  </td>

                  <td className="p-3">{item.service_name}</td>

                  <td className="p-3">{item.note || "-"}</td>

                  <td className="p-3 font-semibold text-slate-900">
                    ৳{Number(item.price).toLocaleString("en-BD")}
                  </td>

                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="submit"
          className="mt-6 rounded-lg bg-slate-900 px-5 py-2.5 font-semibold text-white hover:bg-slate-700"
        >
          Save Consultation
        </button>
      </div>
    </form>
  );
}