import { redirect } from "next/navigation";
import { backendRequest } from "@/lib/api/client";
import { getSessionProfileId } from "@/lib/auth/session";
import type { Profile, UserRole } from "@/types/app";

export async function getCurrentProfile(): Promise<Profile | null> {
  const profileId = await getSessionProfileId();
  if (!profileId) return null;
  const result = await backendRequest<{ profile: Profile | null }>("/api/auth/profile", {
    profileId,
  });
  return result.profile;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  return profile;
}

export async function requireRole(allowedRoles: UserRole[]) {
  const profile = await requireProfile();

  if (!allowedRoles.includes(profile.role)) {
    redirect("/dashboard");
  }

  return profile;
}

export function getDashboardPath(role: UserRole) {
  if (role === "patient") return "/dashboard/patient";
  if (role === "compounder") return "/dashboard/compounder";
  if (role === "doctor") return "/dashboard/doctor";
  if (role === "admin") return "/dashboard/admin";
  if (role === "admin_doctor") return "/dashboard/admin";

  return "/dashboard";
}