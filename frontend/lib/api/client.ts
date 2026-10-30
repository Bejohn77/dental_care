import "server-only";
import { cookies } from "next/headers";

const SESSION_COOKIE = "medico_session";

export class BackendApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "BackendApiError";
  }
}

async function sendBackendRequest<T>(
  path: string,
  payload: Record<string, unknown>
): Promise<{ result: T; response: Response }> {
  const baseUrl = process.env.BACKEND_API_URL;
  if (!baseUrl) {
    throw new Error("BACKEND_API_URL is required.");
  }

  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("BACKEND_API_URL must be a valid URL.");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("BACKEND_API_URL must use HTTPS in production.");
  }

  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = `${SESSION_COOKIE}=${cookie}`;

  const response = await fetch(`${url.toString().replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    credentials: "include",
    cache: "no-store",
  });

  let result: { error?: string; [key: string]: unknown };
  try {
    result = (await response.json()) as { error?: string; [key: string]: unknown };
  } catch {
    throw new Error(`Backend returned an invalid response (${response.status}).`);
  }
  if (!response.ok) {
    throw new BackendApiError(result.error ?? "Backend request failed.", response.status);
  }
  return { result: result as T, response };
}

export async function backendRequest<T>(
  path: string,
  payload: Record<string, unknown>
): Promise<T> {
  const { result } = await sendBackendRequest<T>(path, payload);
  return result;
}

export async function backendAuthRequest<T>(
  path: "/api/auth/register" | "/api/auth/login",
  payload: Record<string, unknown>
): Promise<{ result: T; token: string }> {
  const { result, response } = await sendBackendRequest<T>(path, payload);
  const cookie = response.headers.get("set-cookie");
  const token = cookie?.match(/(?:^|;\s*)medico_session=([^;]*)/)?.[1];
  if (!token) {
    throw new Error("Backend authentication response did not include a session cookie.");
  }
  return { result, token };
}
