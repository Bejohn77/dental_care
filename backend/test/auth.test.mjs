import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { authenticateAccount, registerPatient } from "../account-service.mjs";
import { authorizeDatabaseQuery } from "../authorization.mjs";
import { ensureAdminAccount, getAdminCredentials } from "../admin-bootstrap.mjs";
import { signSessionToken, verifySessionToken } from "../session-token.mjs";

class MemoryDatabase {
  collections = new Map();

  collection(name) {
    if (!this.collections.has(name)) this.collections.set(name, []);
    const records = this.collections.get(name);
    return {
      findOne: async (filter) =>
        records.find((record) =>
          Object.entries(filter).every(([key, value]) => record[key] === value)
        ) ?? null,
      insertOne: async (record) => {
        records.push({ ...record });
        return { insertedId: record.id };
      },
      deleteOne: async (filter) => {
        const index = records.findIndex((record) =>
          Object.entries(filter).every(([key, value]) => record[key] === value)
        );
        if (index !== -1) records.splice(index, 1);
        return { deletedCount: index === -1 ? 0 : 1 };
      },
    };
  }
}

test("admin bootstrap hashes credentials, supports login, and never resets an existing password", async () => {
  const database = new MemoryDatabase();
  const adminPassword = randomBytes(24).toString("base64url");
  const changedPassword = randomBytes(24).toString("base64url");
  const initialCredentials = getAdminCredentials({
    ADMIN_EMAIL: " ADMIN@EXAMPLE.COM ",
    ADMIN_PASSWORD: adminPassword,
  });

  assert.equal(await ensureAdminAccount(database, initialCredentials), true);
  const storedUser = await database.collection("users").findOne({
    email: "admin@example.com",
  });
  assert.ok(storedUser.password_hash);
  assert.notEqual(storedUser.password_hash, initialCredentials.password);

  const profile = await authenticateAccount(
    database,
    "ADMIN@example.com",
    initialCredentials.password
  );
  assert.equal(profile.role, "admin");

  assert.equal(
    await ensureAdminAccount(database, {
      email: initialCredentials.email,
      password: changedPassword,
    }),
    false
  );
  assert.equal(
    (await authenticateAccount(database, initialCredentials.email, initialCredentials.password)).role,
    "admin"
  );
  assert.equal(
    await authenticateAccount(database, initialCredentials.email, changedPassword),
    null
  );
  const testSecret = "test-secret-with-at-least-thirty-two-characters";
  const sessionToken = signSessionToken(profile.id, "admin-session", 100, 200, testSecret);
  assert.equal(verifySessionToken(sessionToken, testSecret, 150).sub, profile.id);
});

test("patient registration stores a bcrypt hash and supports password login", async () => {
  const database = new MemoryDatabase();
  const profile = await registerPatient(database, {
    full_name: "Patient Example",
    email: "PATIENT@example.com",
    password: "patient-password",
    phone: "555-0100",
    age: 30,
    sex: "other",
    address: null,
  });
  const user = await database.collection("users").findOne({ id: profile.id });

  assert.equal(profile.role, "patient");
  assert.notEqual(user.password_hash, "patient-password");
  assert.equal(
    (await authenticateAccount(database, "patient@example.com", "patient-password")).id,
    profile.id
  );
  assert.equal(
    await authenticateAccount(database, "patient@example.com", "wrong-password"),
    null
  );
});

test("JWT verification rejects tampered and expired sessions", () => {
  const secret = "test-secret-with-at-least-thirty-two-characters";
  const token = signSessionToken("profile-1", "session-1", 100, 200, secret);
  const [header, payload, signature] = token.split(".");
  const tampered = `${header}.${payload}.${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;

  assert.equal(verifySessionToken(token, secret, 150).sub, "profile-1");
  assert.equal(verifySessionToken(token, secret, 200), null);
  assert.equal(verifySessionToken(tampered, secret, 150), null);
});

test("backend query authorization denies patients admin data operations", () => {
  const patient = { userId: "patient-1", role: "patient" };
  const admin = { userId: "admin-1", role: "admin" };

  assert.throws(
    () => authorizeDatabaseQuery({ table: "profiles", action: "find" }, patient),
    { status: 403 }
  );
  assert.throws(
    () => authorizeDatabaseQuery({ table: "services", action: "insert" }, patient),
    { status: 403 }
  );
  assert.throws(
    () => authorizeDatabaseQuery({ table: "appointments", action: "find" }, patient),
    { status: 403 }
  );
  assert.equal(
    authorizeDatabaseQuery({ table: "services", action: "insert" }, admin),
    true
  );
});

test("admin environment validation rejects missing and unsafe values", () => {
  assert.throws(() => getAdminCredentials({}), /ADMIN_EMAIL and ADMIN_PASSWORD/);
  assert.throws(
    () => getAdminCredentials({ ADMIN_EMAIL: "bad-email", ADMIN_PASSWORD: "long-enough-password" }),
    /ADMIN_EMAIL must be a valid email/
  );
  assert.throws(
    () => getAdminCredentials({ ADMIN_EMAIL: "admin@example.com", ADMIN_PASSWORD: "short" }),
    /ADMIN_PASSWORD must be at least 12 characters/
  );
});
