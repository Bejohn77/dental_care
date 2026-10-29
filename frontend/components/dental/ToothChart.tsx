"use client";

const upperRight = ["18", "17", "16", "15", "14", "13", "12", "11"];
const upperLeft = ["21", "22", "23", "24", "25", "26", "27", "28"];
const lowerRight = ["48", "47", "46", "45", "44", "43", "42", "41"];
const lowerLeft = ["31", "32", "33", "34", "35", "36", "37", "38"];

type ToothChartProps = {
  selectedTeeth: string[];
  onChange: (teeth: string[]) => void;
};

export default function ToothChart({
  selectedTeeth,
  onChange,
}: ToothChartProps) {
  function toggleTooth(tooth: string) {
    if (selectedTeeth.includes(tooth)) {
      onChange(selectedTeeth.filter((item) => item !== tooth));
    } else {
      onChange([...selectedTeeth, tooth]);
    }
  }

  function renderTooth(tooth: string) {
    const selected = selectedTeeth.includes(tooth);

    return (
      <button
        key={tooth}
        type="button"
        onClick={() => toggleTooth(tooth)}
        className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${
          selected
            ? "border-teal-600 bg-teal-600 text-white"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        {tooth}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <div className="mb-4 text-center">
        <p className="text-sm font-bold text-slate-900">FDI Tooth Chart</p>
        <p className="text-xs text-slate-500">
          Select one or multiple teeth before adding a tooth-based service.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500">
            Upper Teeth
          </p>

          <div className="grid grid-cols-8 gap-2">
            {[...upperRight, ...upperLeft].map(renderTooth)}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500">
            Lower Teeth
          </p>

          <div className="grid grid-cols-8 gap-2">
            {[...lowerRight, ...lowerLeft].map(renderTooth)}
          </div>
        </div>
      </div>

      {selectedTeeth.length > 0 && (
        <div className="mt-4 rounded-lg bg-white p-3 text-sm">
          <span className="font-semibold text-slate-700">Selected:</span>{" "}
          <span className="text-teal-700">{selectedTeeth.join(", ")}</span>
        </div>
      )}
    </div>
  );
}