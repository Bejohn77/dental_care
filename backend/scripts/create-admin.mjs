import { hash } from "bcryptjs";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";

const {
  MONGODB_URI,
  MONGODB_DB,
  BOOTSTRAP_ADMIN_EMAIL,
  BOOTSTRAP_ADMIN_PASSWORD,
  BOOTSTRAP_ADMIN_NAME,
} = process.env;

if (
  !MONGODB_URI ||
  !MONGODB_DB ||
  !BOOTSTRAP_ADMIN_EMAIL ||
  !BOOTSTRAP_ADMIN_PASSWORD ||
  !BOOTSTRAP_ADMIN_NAME
) {
  throw new Error(
    "Set MONGODB_URI, MONGODB_DB, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, and BOOTSTRAP_ADMIN_NAME."
  );
}

if (BOOTSTRAP_ADMIN_PASSWORD.length < 12) {
  throw new Error("The initial admin password must be at least 12 characters.");
}

const client = new MongoClient(MONGODB_URI);

try {
  await client.connect();
  const database = client.db(MONGODB_DB);
  const profiles = database.collection("profiles");
  const users = database.collection("users");

  if ((await profiles.countDocuments()) > 0) {
    throw new Error(
      "Admin bootstrap is only allowed while the profiles collection is empty."
    );
  }

  const email = BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
  const id = randomUUID();
  const now = new Date().toISOString();
  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ id: 1 }, { unique: true });
  await profiles.createIndex({ id: 1 }, { unique: true });

  await users.insertOne({
    id,
    email,
    password_hash: await hash(BOOTSTRAP_ADMIN_PASSWORD, 12),
    created_at: now,
  });

  try {
    await profiles.insertOne({
      id,
      full_name: BOOTSTRAP_ADMIN_NAME.trim(),
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

  console.log(`Created initial admin account for ${email}.`);
} finally {
  await client.close();
}