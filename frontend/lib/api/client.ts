import "server-only";

export class BackendApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "BackendApiError";
  }
}

export async function backendRequest<T>(
  path: string,
  payload: Record<string, unknown>
): Promise<T> {
  const baseUrl = process.env.BACKEND_API_URL;
  const apiKey = process.env.BACKEND_API_KEY;
  if (!baseUrl || !apiKey || apiKey.length < 32) {
    throw new Error("BACKEND_API_URL and a 32-character BACKEND_API_KEY are required.");
  }

  const url = new URL(baseUrl);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("BACKEND_API_URL must use HTTPS in production.");
  }

  const response = await fetch(`${url.toString().replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const result = (await response.json()) as {
    error?: string;
    [key: string]: unknown;
  };
  if (!response.ok) {
    throw new BackendApiError(result.error ?? "Backend request failed.", response.status);
  }
  return result as T;
}
