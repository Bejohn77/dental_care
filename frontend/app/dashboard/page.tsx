import { redirect } from "next/navigation";
import { getDashboardPath, requireProfile } from "@/lib/auth";

export default async function DashboardPage() {
  const profile = await requireProfile();

  redirect(getDashboardPath(profile.role));

  return null;
}