"use client";

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { savePatientSignatureAction } from "@/app/dashboard/doctor/agreement/[consultationId]/actions";

type PatientSignaturePadProps = {
  consultationId: string;
};

export default function PatientSignaturePad({
  consultationId,
}: PatientSignaturePadProps) {
  const signatureRef = useRef<SignatureCanvas | null>(null);
  const [signature, setSignature] = useState("");

  function clearSignature() {
    signatureRef.current?.clear();
    setSignature("");
  }

  function saveSignatureToInput() {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      alert("Please ask the patient to sign first.");
      return;
    }

    const signatureImage = signatureRef.current
      .getTrimmedCanvas()
      .toDataURL("image/png");

    setSignature(signatureImage);
  }

  return (
    <div className="rounded-2xl border p-4">
      <h3 className="font-bold text-slate-900">Patient Signature</h3>

      <p className="mt-1 text-sm text-slate-600">
        Ask the patient to sign inside the box below.
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border bg-white">
        <SignatureCanvas
          ref={signatureRef}
          penColor="black"
          canvasProps={{
            width: 700,
            height: 220,
            className: "block max-w-full",
          }}
        />
      </div>

      {signature && (
        <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700">
          Signature captured. Now click “Save Signature”.
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={saveSignatureToInput}
          className="rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white hover:bg-teal-700"
        >
          Capture Signature
        </button>

        <button
          type="button"
          onClick={clearSignature}
          className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
        >
          Clear
        </button>
      </div>

      <form action={savePatientSignatureAction} className="mt-4">
        <input type="hidden" name="consultation_id" value={consultationId} />
        <input type="hidden" name="patient_signature" value={signature} />

        <button
          type="submit"
          disabled={!signature}
          className="rounded-lg bg-slate-900 px-5 py-2.5 font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Save Signature
        </button>
      </form>
    </div>
  );
}