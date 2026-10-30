import "server-only";
import { cookies } from "next/headers";
import { backendAuthRequest, BackendApiError } from "@/lib/api/client";
import type { Profile } from "@/types/app";

const SESSION_COOKIE = "medico_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export async function setSession(token: string) {
  if (!token) {
    throw new Error("The backend did not issue an authentication session.");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function createProfileAccount(input: {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  age: number | null;
  sex: Profile["sex"];
  address: string | null;
}) {
  const { result, token } = await backendAuthRequest<{ profile: Profile }>(
    "/api/auth/register",
    input
  );
  return { profile: result.profile, token };
}

export async function authenticateAccount(email: string, password: string) {
  try {
    const { result, token } = await backendAuthRequest<{ profile: Profile }>(
      "/api/auth/login",
      { email, password }
    );
    return { profile: result.profile, token };
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 401) return null;
    throw error;
  }
}
