import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { backendRequest, BackendApiError } from "@/lib/api/client";
import type { Profile } from "@/types/app";

const SESSION_COOKIE = "medico_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
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
  const result = await backendRequest<{ profile: Profile }>("/api/auth/register", input);
  return result.profile;
}

export async function authenticateAccount(email: string, password: string) {
  try {
    const result = await backendRequest<{ profile: Profile }>("/api/auth/login", {
      email,
      password,
    });
    return result.profile;
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 401) return null;
    throw error;
  }
}

export async function setSession(profileId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(profileId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSessionSecret());

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

export async function getSessionProfileId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    return payload.sub ?? null;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name.startsWith("JWT") || error.name.startsWith("JWS"))
    ) {
      return null;
    }
    throw error;
  }
}
