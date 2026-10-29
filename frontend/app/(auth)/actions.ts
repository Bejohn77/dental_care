"use server";

import { redirect } from "next/navigation";
import { BackendApiError } from "@/lib/api/client";
import {
  authenticateAccount,
  clearSession,
  createProfileAccount,
  setSession,
} from "@/lib/auth/session";

function safeString(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function registerAction(formData: FormData) {
  const fullName = safeString(formData.get("full_name"));
  const email = safeString(formData.get("email")).toLowerCase();
  const password = safeString(formData.get("password"));
  const phone = safeString(formData.get("phone"));
  const ageValue = safeString(formData.get("age"));
  const sex = safeString(formData.get("sex"));
  const address = safeString(formData.get("address"));

  if (!fullName) {
    redirectWithError("/register", "Full name is required");
  }

  if (!email) {
    redirectWithError("/register", "Email is required");
  }

  if (password.length < 8) {
    redirectWithError("/register", "Password must be at least 8 characters");
  }

  if (!["male", "female", "other"].includes(sex)) {
    redirectWithError("/register", "Please select a valid sex");
  }

  const age = ageValue ? Number(ageValue) : null;
  if (age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) {
    redirectWithError("/register", "Please enter a valid age");
  }

  let profile;
  try {
    profile = await createProfileAccount({
      full_name: fullName,
      email,
      password,
      phone,
      age,
      sex: sex as "male" | "female" | "other",
      address: address || null,
    });
  } catch (error) {
    if (
      error instanceof BackendApiError &&
      error.status === 409
    ) {
      redirectWithError("/register", "An account with this email already exists");
    }
    throw error;
  }
  await setSession(profile.id);

  redirect("/dashboard");
}

export async function loginAction(formData: FormData) {
  const email = safeString(formData.get("email")).toLowerCase();
  const password = safeString(formData.get("password"));

  if (!email || !password) {
    redirectWithError("/login", "Email and password are required");
  }

  const profile = await authenticateAccount(email, password);
  if (!profile) {
    redirectWithError("/login", "Invalid email or password");
  }
  await setSession(profile.id);

  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}