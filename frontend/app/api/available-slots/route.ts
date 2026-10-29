import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/mongodb";

export async function GET(request: NextRequest) {
  const doctorId = request.nextUrl.searchParams.get("doctorId") ?? "";
  const date = request.nextUrl.searchParams.get("date") ?? "";

  if (!doctorId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Doctor and a valid appointment date are required." },
      { status: 400 }
    );
  }

  const { data: slots, error } = await createClient().rpc("get_available_slots", {
    p_doctor_id: doctorId,
    p_date: date,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ slots });
}
