import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MINIMUM_PASSWORD_LENGTH = 12;

export function getAdminCredentials(environment = process.env) {
  const email = environment.ADMIN_EMAIL?.trim().toLowerCase();
  const password = environment.ADMIN_PASSWORD;

  if (!email || !password || !password.trim()) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required to start the backend.");
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("ADMIN_EMAIL must be a valid email address.");
  }
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
  }

  return { email, password };
}

export async function ensureAdminAccount(database, { email, password }) {
  const users = database.collection("users");
  const profiles = database.collection("profiles");
  const existingProfile = await profiles.findOne({ email });

  if (existingProfile) {
    if (existingProfile.role !== "admin") {
      throw new Error("ADMIN_EMAIL is already assigned to a non-admin profile.");
    }
    const existingUser = await users.findOne({ id: existingProfile.id, email });
    if (!existingUser) {
      throw new Error("The configured admin profile has no matching user login record.");
    }
    return false;
  }

  if (await users.findOne({ email })) {
    throw new Error("ADMIN_EMAIL already has a user record without an admin profile.");
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  await users.insertOne({
    id,
    email,
    password_hash: await hash(password, 12),
    created_at: now,
  });

  try {
    await profiles.insertOne({
      id,
      full_name: email.split("@")[0],
      email,
      phone: null,
      age: null,
      sex: null,
      address: null,
      role: "admin",
      created_at: now,
      updated_at: now,
    });
  } catch (error) {
    await users.deleteOne({ id });
    throw error;
  }

  return true;
}
