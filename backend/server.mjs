import { createServer } from "node:http";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { MongoClient } from "mongodb";
import { compare, hash } from "bcryptjs";

const port = Number(process.env.PORT ?? 10000);
const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB;
const jwtSecret = process.env.JWT_SECRET;
const sessionDurationSeconds = 60 * 60 * 24 * 7;
const sessionCookieName = "medico_session";
const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);
const tables = new Set([
  "profiles", "appointments", "doctors", "doctor_schedules",
  "services", "patient_prechecks", "consultations", "consultation_services",
  "agreements", "invoices", "payments",
]);

if (!uri || !databaseName || !jwtSecret || jwtSecret.length < 32 || !allowedOrigins.size) {
  throw new Error("MONGODB_URI, MONGODB_DB, a 32-character JWT_SECRET, and FRONTEND_ORIGINS are required.");
}

const client = new MongoClient(uri, {
  maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE ?? 10),
  serverSelectionTimeoutMS: 10000,
});
const databasePromise = client.connect().then(async () => {
  const database = client.db(databaseName);
  await Promise.all([
    database.collection("users").createIndex({ email: 1 }, { unique: true }),
    database.collection("auth_sessions").createIndex({ jti: 1 }, { unique: true }),
    database.collection("auth_sessions").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    ...[...tables].filter((table) => table !== "users").map((table) =>
      database.collection(table).createIndex({ id: 1 }, { unique: true })
    ),
    database.collection("patient_prechecks").createIndex({ appointment_id: 1 }, { unique: true, sparse: true }),
    database.collection("consultations").createIndex({ appointment_id: 1 }, { unique: true, sparse: true }),
    database.collection("agreements").createIndex({ consultation_id: 1 }, { unique: true, sparse: true }),
    database.collection("invoices").createIndex({ consultation_id: 1 }, { unique: true, sparse: true }),
  ]);
  return database;
});

const relationSpecs = {
  consultations: {
    doctors: { localField: "doctor_id", foreignField: "id" },
    consultation_services: { localField: "id", foreignField: "consultation_id", many: true },
  },
  invoices: { doctors: { localField: "doctor_id", foreignField: "id" } },
  doctor_schedules: { doctors: { localField: "doctor_id", foreignField: "id" } },
  appointments: {
    doctors: { localField: "doctor_id", foreignField: "id" },
    profiles: { localField: "patient_id", foreignField: "id" },
  },
  payments: {
    receiver: { localField: "received_by", foreignField: "id" },
    profiles: { localField: "received_by", foreignField: "id" },
  },
};

function signJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const unsignedToken = `${header}.${body}`;
  const signature = createHmac("sha256", jwtSecret).update(unsignedToken).digest("base64url");
  return `${unsignedToken}.${signature}`;
}

function readSessionCookie(request) {
  const cookie = String(request.headers.cookie ?? "")
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${sessionCookieName}=`));
  return cookie?.slice(sessionCookieName.length + 1) ?? null;
}

async function authenticateRequest(request) {
  const token = readSessionCookie(request);
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (
    !header ||
    typeof header !== "object" ||
    header.alg !== "HS256" ||
    header.typ !== "JWT" ||
    !payload ||
    typeof payload !== "object"
  ) {
    return null;
  }

  const expected = createHmac("sha256", jwtSecret)
    .update(`${parts[0]}.${parts[1]}`)
    .digest();
  const actual = Buffer.from(parts[2], "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (
    typeof payload.sub !== "string" ||
    typeof payload.jti !== "string" ||
    payload.iss !== "medico-dental-care-api" ||
    payload.aud !== "medico-dental-care-frontend" ||
    !Number.isInteger(payload.exp) ||
    payload.exp <= now ||
    !Number.isInteger(payload.iat) ||
    payload.iat > now + 60
  ) {
    return null;
  }

  const session = await (await databasePromise)
    .collection("auth_sessions")
    .findOne({ jti: payload.jti, user_id: payload.sub, expires_at: { $gt: new Date() } });
  return session ? { userId: payload.sub, jti: payload.jti } : null;
}

function sessionCookie(token, maxAge) {
  return `${sessionCookieName}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=None; Secure`;
}

async function createSession(profileId) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((issuedAt + sessionDurationSeconds) * 1000);
  const jti = randomUUID();
  await (await databasePromise).collection("auth_sessions").insertOne({
    jti,
    user_id: profileId,
    expires_at: expiresAt,
  });
  return {
    token: signJwt({
      iss: "medico-dental-care-api",
      aud: "medico-dental-care-frontend",
      sub: profileId,
      jti,
      iat: issuedAt,
      exp: Math.floor(expiresAt.getTime() / 1000),
    }),
    expiresAt,
  };
}

function parseJoins(select) {
  const joins = [];
  const pattern = /([\w]+):([\w]+)(?:![\w]+)?\(([^()]*)\)|([\w]+)\(([^()]*)\)/g;
  for (const match of select.matchAll(pattern)) {
    joins.push({ alias: match[1] ?? match[4], collection: match[2] ?? match[4], fields: match[3] ?? match[5] });
  }
  return joins;
}

function project(document, select) {
  const { _id, ...row } = document;
  void _id;
  if (select.includes("*")) return row;
  const result = { id: row.id };
  for (const field of select.split(",").map((value) => value.trim())) {
    if (field && !field.includes("(") && field in row) result[field] = row[field];
  }
  return result;
}

function relationFor(table, alias, relation) {
  return relationSpecs[table]?.[alias] ?? relationSpecs[table]?.[relation] ?? {
    localField: `${relation.endsWith("s") ? relation.slice(0, -1) : relation}_id`,
    foreignField: "id",
  };
}

async function attachJoins(database, table, documents, select) {
  for (const join of parseJoins(select)) {
    if (!tables.has(join.collection)) throw new Error("Unsupported relation.");
    const relation = relationFor(table, join.alias, join.collection);
    const localValues = documents.map((item) => item[relation.localField]).filter((value) => value != null);
    const foreign = localValues.length
      ? (await database.collection(join.collection).find({ [relation.foreignField]: { $in: localValues } }).toArray())
        .map((item) => project(item, join.fields))
      : [];
    for (const document of documents) {
      const matches = foreign.filter((item) => item[relation.foreignField] === document[relation.localField]);
      document[join.alias] = relation.many ? matches : matches[0] ?? null;
    }
  }
  return documents;
}

function getUpsertKey(table, value) {
  if (value.id) return "id";
  if (["agreements", "invoices"].includes(table)) return "consultation_id";
  if (["consultations", "patient_prechecks"].includes(table)) return "appointment_id";
  return "id";
}

async function query(input) {
  const { table, action = "find", filters = {}, payload = {}, selectClause = "*", sort = {} } = input;
  if (!tables.has(table)) throw new Error("Unsupported collection.");
  const collection = (await databasePromise).collection(table);
  let data = [];
  let count;

  if (action === "insert") {
    const values = Array.isArray(payload) ? payload : [payload];
    const now = new Date().toISOString();
    data = values.map((value) => ({
      ...value,
      id: typeof value.id === "string" ? value.id : crypto.randomUUID(),
      created_at: typeof value.created_at === "string" ? value.created_at : now,
      updated_at: typeof value.updated_at === "string" ? value.updated_at : now,
    }));
    await collection.insertMany(data);
  } else if (action === "upsert") {
    for (const value of (Array.isArray(payload) ? payload : [payload])) {
      const key = input.upsertKey ?? getUpsertKey(table, value);
      const filter = { [key]: value[key] };
      const existing = await collection.findOne(filter);
      const now = new Date().toISOString();
      const document = {
        ...value,
        id: existing?.id ?? value.id ?? crypto.randomUUID(),
        created_at: existing?.created_at ?? value.created_at ?? now,
        updated_at: now,
      };
      await collection.updateOne(filter, { $set: document }, { upsert: true });
      const saved = await collection.findOne(filter);
      if (saved) data.push(project(saved, "*"));
    }
  } else if (action === "update") {
    if (!Object.keys(filters).length) throw new Error("An update filter is required.");
    const result = await collection.updateMany(filters, { $set: { ...payload, updated_at: new Date().toISOString() } });
    if (result.matchedCount) data = (await collection.find(filters).toArray()).map((item) => project(item, "*"));
  } else if (action === "delete") {
    if (!Object.keys(filters).length) throw new Error("A delete filter is required.");
    count = (await collection.deleteMany(filters)).deletedCount;
  } else if (action === "find") {
    if (input.countMode) count = await collection.countDocuments(filters);
    if (!input.headOnly) {
      let cursor = collection.find(filters);
      if (Object.keys(sort).length) cursor = cursor.sort(sort);
      if (Number.isInteger(input.maxResults) && input.maxResults >= 0) cursor = cursor.limit(input.maxResults);
      data = await cursor.toArray();
      data = await attachJoins(await databasePromise, table, data.map((item) => project(item, selectClause)), selectClause);
    }
  } else {
    throw new Error("Unsupported query operation.");
  }

  if (input.isSingle) {
    if (data.length > 1 || (!data.length && !input.allowEmptySingle)) {
      return { data: null, error: { message: "Expected exactly one matching document." }, ...(count === undefined ? {} : { count }) };
    }
    return { data: data[0] ?? null, error: null, ...(count === undefined ? {} : { count }) };
  }
  return { data, error: null, ...(count === undefined ? {} : { count }) };
}

async function queryPublic(input) {
  const { table, action = "find", filters = {} } = input;
  if (
    !["doctors", "services"].includes(table) ||
    action !== "find" ||
    filters.is_active !== true ||
    Object.keys(filters).length !== 1
  ) {
    const error = new Error("Authentication is required for this database request.");
    error.status = 401;
    throw error;
  }

  const fields = table === "doctors"
    ? ["id", "name", "designation", "speciality", "bio", "consultation_fee", "photo_url", "is_active"]
    : ["id", "name", "category", "description", "base_price", "is_tooth_based", "is_active"];
  const limit = Number.isInteger(input.maxResults) && input.maxResults >= 0
    ? Math.min(input.maxResults, 100)
    : 100;
  const documents = await (await databasePromise)
    .collection(table)
    .find({ is_active: true })
    .sort({ name: 1 })
    .limit(limit)
    .toArray();
  const data = documents.map((document) =>
    Object.fromEntries(fields.filter((field) => field in document).map((field) => [field, document[field]]))
  );
  return { data, error: null };
}

async function rpc(name, args) {
  if (name !== "get_available_slots") throw new Error("Unknown database operation.");
  const { p_date: date, p_doctor_id: doctorId } = args;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !doctorId) throw new Error("Doctor and a valid appointment date are required.");
  const database = await databasePromise;
  const schedule = await database.collection("doctor_schedules").findOne({
    doctor_id: doctorId,
    day_of_week: new Date(`${date}T00:00:00`).getDay(),
    is_active: true,
  });
  if (!schedule) return { data: [], error: null };
  const appointments = await database.collection("appointments").find({
    doctor_id: doctorId,
    appointment_date: date,
    status: { $ne: "cancelled" },
  }).project({ start_time: 1 }).toArray();
  const booked = new Set(appointments.map((item) => item.start_time));
  const [startHour, startMinute] = String(schedule.start_time).split(":").map(Number);
  const [endHour, endMinute] = String(schedule.end_time).split(":").map(Number);
  const duration = Number(schedule.slot_minutes);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Invalid slot duration.");
  const format = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  const slots = [];
  for (let time = startHour * 60 + startMinute; time + duration <= endHour * 60 + endMinute; time += duration) {
    if (!booked.has(format(time))) slots.push({ start_time: format(time), end_time: format(time + duration) });
  }
  return { data: slots, error: null };
}

async function auth(path, body) {
  const database = await databasePromise;
  const users = database.collection("users");
  const profiles = database.collection("profiles");
  if (path === "/api/auth/register") {
    const { full_name, email, password, phone, age, sex, address } = body;
    if (
      typeof full_name !== "string" ||
      !full_name.trim() ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== "string" ||
      password.length < 8 ||
      typeof phone !== "string"
    ) {
      return { status: 400, body: { error: "Invalid registration details." } };
    }
    if (
      !["male", "female", "other"].includes(sex) ||
      (age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) ||
      (address !== null && typeof address !== "string")
    ) {
      return { status: 400, body: { error: "Invalid profile details." } };
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    const normalizedEmail = email.trim().toLowerCase();
    await users.insertOne({ id, email: normalizedEmail, password_hash: await hash(password, 12), created_at: now });
    const profile = { id, full_name: full_name.trim(), email: normalizedEmail, phone: phone || null, age, sex, address: address || null, role: "patient", created_at: now, updated_at: now };
    try {
      await profiles.insertOne(profile);
    } catch (error) {
      await users.deleteOne({ id });
      throw error;
    }
    const session = await createSession(id);
    return { status: 201, body: { profile }, headers: { "Set-Cookie": sessionCookie(session.token, sessionDurationSeconds) } };
  }
  if (path === "/api/auth/login") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const user = await users.findOne({ email });
    if (!user || !(await compare(password, user.password_hash ?? ""))) {
      return { status: 401, body: { error: "Invalid email or password." } };
    }
    const profile = await profiles.findOne({ id: user.id });
    if (!profile) return { status: 401, body: { error: "Invalid email or password." } };
    const session = await createSession(profile.id);
    return { status: 200, body: { profile }, headers: { "Set-Cookie": sessionCookie(session.token, sessionDurationSeconds) } };
  }
  if (path === "/api/auth/profile") {
    const profile = await profiles.findOne({ id: body.session.userId });
    return { status: 200, body: { profile: profile ?? null } };
  }
  if (path === "/api/auth/logout") {
    await database.collection("auth_sessions").deleteOne({ jti: body.session.jti });
    return {
      status: 200,
      body: { success: true },
      headers: { "Set-Cookie": sessionCookie("", 0) },
    };
  }
  return { status: 404, body: { error: "Not found." } };
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) {
      const error = new Error("Request body too large.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    const error = new Error("Invalid JSON request body.");
    error.status = 400;
    throw error;
  }
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader("Access-Control-Allow-Credentials", "true");
  } else if (origin && allowedOrigins.size) {
    response.writeHead(403).end();
    return;
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  if (request.method === "GET" && path === "/health") {
    try {
      await (await databasePromise).command({ ping: 1 });
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ status: "ok" }));
    } catch {
      response.writeHead(503, { "Content-Type": "application/json" }).end(JSON.stringify({ status: "unavailable" }));
    }
    return;
  }
  if (request.method !== "POST" || !["/api/query", "/api/rpc", "/api/auth/register", "/api/auth/login", "/api/auth/profile", "/api/auth/logout"].includes(path)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const body = await readJson(request);
    const publicAuthRoute = path === "/api/auth/register" || path === "/api/auth/login";
    const session = publicAuthRoute ? null : await authenticateRequest(request);
    if (!publicAuthRoute && !session && !["/api/query", "/api/rpc"].includes(path)) {
      response.writeHead(401, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ error: "Unauthorized." }));
      return;
    }

    const result = path === "/api/query"
      ? { status: 200, body: session ? await query(body) : await queryPublic(body) }
      : path === "/api/rpc"
        ? { status: 200, body: await rpc(body.name, body.args ?? {}) }
        : await auth(path, { ...body, session });
    response.writeHead(result.status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...result.headers,
    });
    response.end(JSON.stringify(result.body));
  } catch (error) {
    const duplicate = error && typeof error === "object" && error.code === 11000;
    const status = duplicate ? 409 : error?.status ?? 500;
    if (status >= 500) console.error("API request failed:", error);
    response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({
      error: duplicate
        ? "An account with this email already exists."
        : status >= 500
          ? "The request could not be completed."
          : error instanceof Error
            ? error.message
            : "Request failed.",
    }));
  }
});

databasePromise
  .then(() => {
    server.listen(port, "0.0.0.0", () => {
      console.log(`Medico Dental API listening on port ${port}`);
    });
  })
  .catch((error) => {
  console.error("MongoDB connection failed during startup:", error);
  process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(async () => {
    await client.close();
    process.exit(0);
  }));
}