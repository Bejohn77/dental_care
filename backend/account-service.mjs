import { randomUUID } from "node:crypto";
import { compare, hash } from "bcryptjs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export async function registerPatient(database, input) {
  const { full_name, email, password, phone, age, sex, address } = input;
  if (
    typeof full_name !== "string" ||
    !full_name.trim() ||
    typeof email !== "string" ||
    !EMAIL_PATTERN.test(email.trim()) ||
    typeof password !== "string" ||
    password.length < 8 ||
    typeof phone !== "string"
  ) {
    throw validationError("Invalid registration details.");
  }
  if (
    !["male", "female", "other"].includes(sex) ||
    (age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) ||
    (address !== null && typeof address !== "string")
  ) {
    throw validationError("Invalid profile details.");
  }

  const users = database.collection("users");
  const profiles = database.collection("profiles");
  const id = randomUUID();
  const now = new Date().toISOString();
  const normalizedEmail = email.trim().toLowerCase();
  await users.insertOne({
    id,
    email: normalizedEmail,
    password_hash: await hash(password, 12),
    created_at: now,
  });
  const profile = {
    id,
    full_name: full_name.trim(),
    email: normalizedEmail,
    phone: phone || null,
    age,
    sex,
    address: address || null,
    role: "patient",
    created_at: now,
    updated_at: now,
  };
  try {
    await profiles.insertOne(profile);
  } catch (error) {
    await users.deleteOne({ id });
    throw error;
  }
  return profile;
}

export async function authenticateAccount(database, emailInput, passwordInput) {
  const email = String(emailInput ?? "").trim().toLowerCase();
  const password = String(passwordInput ?? "");
  const user = await database.collection("users").findOne({ email });
  if (!user || !(await compare(password, user.password_hash ?? ""))) return null;
  return database.collection("profiles").findOne({ id: user.id });
}
