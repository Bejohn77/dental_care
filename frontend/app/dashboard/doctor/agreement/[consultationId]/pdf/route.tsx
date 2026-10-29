import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  renderToStream,
} from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/db/mongodb";

export const runtime = "nodejs";

type PdfRouteProps = {
  params: Promise<{
    consultationId: string;
  }>;
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 12,
    marginBottom: 16,
  },
  clinicName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f766e",
  },
  subtitle: {
    fontSize: 10,
    marginTop: 4,
    color: "#4b5563",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: 90,
    color: "#6b7280",
  },
  value: {
    flex: 1,
    fontWeight: "bold",
  },
  paragraph: {
    lineHeight: 1.5,
    marginBottom: 8,
  },
  table: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  cell: {
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
  },
  toothCell: {
    width: "15%",
  },
  serviceCell: {
    width: "35%",
  },
  noteCell: {
    width: "30%",
  },
  priceCell: {
    width: "20%",
    borderRightWidth: 0,
  },
  total: {
    marginTop: 10,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "bold",
  },
  signatureBox: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureColumn: {
    width: "45%",
  },
  signatureImage: {
    height: 70,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 5,
  },
  signatureLine: {
    marginTop: 50,
    borderTopWidth: 1,
    borderTopColor: "#111827",
    paddingTop: 4,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
    fontSize: 8,
    color: "#6b7280",
    textAlign: "center",
  },
});

function AgreementPdfDocument({
  consultation,
  agreement,
}: {
  consultation: any;
  agreement: any;
}) {
  const items = consultation.consultation_services ?? [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.clinicName}>Medico Dental Care</Text>
          <Text style={styles.subtitle}>
            Dental Treatment Consent Agreement
          </Text>
        </View>

        <Text style={styles.title}>Treatment Consent Agreement</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Patient Information</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>
              {consultation.patient?.full_name ?? "Unknown"}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>
              {consultation.patient?.phone ?? "-"}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Age / Sex</Text>
            <Text style={styles.value}>
              {consultation.patient?.age ?? "-"} /{" "}
              {consultation.patient?.sex ?? "-"}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Address</Text>
            <Text style={styles.value}>
              {consultation.patient?.address ?? "-"}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Doctor Information</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Doctor</Text>
            <Text style={styles.value}>
              {consultation.doctors?.name ?? "Unknown"}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Speciality</Text>
            <Text style={styles.value}>
              {consultation.doctors?.speciality ?? "Dental Surgeon"}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diagnosis</Text>
          <Text style={styles.paragraph}>{consultation.diagnosis ?? "-"}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Treatment Plan</Text>
          <Text style={styles.paragraph}>
            {consultation.treatment_plan ?? "-"}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Selected Services</Text>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.toothCell]}>Tooth</Text>
              <Text style={[styles.cell, styles.serviceCell]}>Service</Text>
              <Text style={[styles.cell, styles.noteCell]}>Note</Text>
              <Text style={[styles.cell, styles.priceCell]}>Price</Text>
            </View>

            {items.map((item: any) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.cell, styles.toothCell]}>
                  {item.tooth_number ?? "General"}
                </Text>

                <Text style={[styles.cell, styles.serviceCell]}>
                  {item.service_name}
                </Text>

                <Text style={[styles.cell, styles.noteCell]}>
                  {item.note ?? "-"}
                </Text>

                <Text style={[styles.cell, styles.priceCell]}>
                  BDT {Number(item.price).toLocaleString("en-BD")}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.total}>
            Total: BDT{" "}
            {Number(consultation.total_amount).toLocaleString("en-BD")}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Agreement Text</Text>
          <Text style={styles.paragraph}>
            {agreement.agreement_text ?? "Agreement text not found."}
          </Text>
        </View>

        <View style={styles.signatureBox}>
          <View style={styles.signatureColumn}>
            <Image
              src={agreement.patient_signature}
              style={styles.signatureImage}
            />

            <Text style={{ marginTop: 6 }}>Patient Signature</Text>
            <Text style={{ marginTop: 4, fontSize: 8 }}>
              Signed at: {agreement.signed_at ?? "-"}
            </Text>
          </View>

          <View style={styles.signatureColumn}>
            <View style={styles.signatureLine}>
              <Text>Doctor Signature</Text>
            </View>

            <Text style={{ marginTop: 6 }}>
              {consultation.doctors?.name ?? "Doctor"}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          This agreement was generated by Medico Dental Care Management System.
        </Text>
      </Page>
    </Document>
  );
}

async function streamToBuffer(stream: any) {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function getLinkedDoctorId(profileId: string, email: string | null) {
  const supabase = await createClient();

  const { data: linkedDoctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("user_id", profileId)
    .maybeSingle();

  if (linkedDoctor?.id) {
    return linkedDoctor.id as string;
  }

  if (!email) {
    return null;
  }

  const { data: emailDoctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  return (emailDoctor?.id as string) ?? null;
}

export async function GET(request: Request, { params }: PdfRouteProps) {
  const profile = await requireRole(["doctor", "admin", "admin_doctor"]);

  const { consultationId } = await params;
  const supabase = await createClient();

  const { data: consultation, error: consultationError } = await supabase
    .from("consultations")
    .select(
      "*, doctors(*), patient:profiles!consultations_patient_id_fkey(full_name, phone, email, age, sex, address), consultation_services(*)"
    )
    .eq("id", consultationId)
    .single();

  if (consultationError || !consultation) {
    return new Response("Consultation not found", { status: 404 });
  }

  if (profile.role === "doctor") {
    const linkedDoctorId = await getLinkedDoctorId(profile.id, profile.email);

    if (!linkedDoctorId || linkedDoctorId !== consultation.doctor_id) {
      const url = new URL("/dashboard/doctor", request.url);
      url.searchParams.set(
        "error",
        "You are not allowed to download this agreement"
      );

      return NextResponse.redirect(url);
    }
  }

  const { data: agreement, error: agreementError } = await supabase
    .from("agreements")
    .select("*")
    .eq("consultation_id", consultationId)
    .maybeSingle();

  if (agreementError || !agreement) {
    const url = new URL(
      `/dashboard/doctor/agreement/${consultationId}`,
      request.url
    );
    url.searchParams.set("error", "Agreement not found. Save agreement first.");

    return NextResponse.redirect(url);
  }

  if (!agreement.patient_signature) {
    const url = new URL(
      `/dashboard/doctor/agreement/${consultationId}`,
      request.url
    );
    url.searchParams.set(
      "error",
      "Patient signature is required before downloading PDF"
    );

    return NextResponse.redirect(url);
  }

  const pdfStream = await renderToStream(
    <AgreementPdfDocument consultation={consultation} agreement={agreement} />
  );

  const pdfBuffer = await streamToBuffer(pdfStream);

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="medico-dental-agreement-${consultationId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}