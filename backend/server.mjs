import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { MongoClient } from "mongodb";
import { compare, hash } from "bcryptjs";

const port = Number(process.env.PORT ?? 10000);
const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB;
const apiKey = process.env.BACKEND_API_KEY;
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

if (!uri || !databaseName || !apiKey || apiKey.length < 32 || !allowedOrigins.size) {
  throw new Error("MONGODB_URI, MONGODB_DB, a 32-character BACKEND_API_KEY, and FRONTEND_ORIGINS are required.");
}

const client = new MongoClient(uri, {
  maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE ?? 10),
  serverSelectionTimeoutMS: 10000,
});
const databasePromise = client.connect().then(async () => {
  const database = client.db(databaseName);
  await Promise.all([
    database.collection("users").createIndex({ email: 1 }, { unique: true }),
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

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
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
    if (typeof full_name !== "string" || !full_name.trim() || typeof email !== "string" || !email.includes("@") || typeof password !== "string" || password.length < 8) {
      return { status: 400, body: { error: "Invalid registration details." } };
    }
    if (!["male", "female", "other"].includes(sex) || (age !== null && (!Number.isInteger(age) || age < 0 || age > 120))) {
      return { status: 400, body: { error: "Invalid profile details." } };
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await users.insertOne({ id, email: email.trim().toLowerCase(), password_hash: await hash(password, 12), created_at: now });
    const profile = { id, full_name: full_name.trim(), email: email.trim().toLowerCase(), phone: phone || null, age, sex, address: address || null, role: "patient", created_at: now, updated_at: now };
    try {
      await profiles.insertOne(profile);
    } catch (error) {
      await users.deleteOne({ id });
      throw error;
    }
    return { status: 201, body: { profile } };
  }
  if (path === "/api/auth/login") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const user = await users.findOne({ email });
    if (!user || !(await compare(password, user.password_hash ?? ""))) {
      return { status: 401, body: { error: "Invalid email or password." } };
    }
    const profile = await profiles.findOne({ id: user.id });
    return profile ? { status: 200, body: { profile } } : { status: 401, body: { error: "Invalid email or password." } };
  }
  if (path === "/api/auth/profile") {
    const profile = await profiles.findOne({ id: body.profileId });
    return { status: 200, body: { profile: profile ?? null } };
  }
  return { status: 404, body: { error: "Not found." } };
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Request body too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
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
  if (request.method !== "POST" || !["/api/query", "/api/rpc", "/api/auth/register", "/api/auth/login", "/api/auth/profile"].includes(path)) {
    response.writeHead(404).end();
    return;
  }
  if (!safeEqual(String(request.headers["x-api-key"] ?? ""), apiKey)) {
    response.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Unauthorized." }));
    return;
  }
  try {
    const body = await readJson(request);
    const result = path === "/api/query"
      ? { status: 200, body: await query(body) }
      : path === "/api/rpc"
        ? { status: 200, body: await rpc(body.name, body.args ?? {}) }
        : await auth(path, body);
    response.writeHead(result.status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(result.body));
  } catch (error) {
    const duplicate = error && typeof error === "object" && error.code === 11000;
    response.writeHead(duplicate ? 409 : 400, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ error: duplicate ? "An account with this email already exists." : error instanceof Error ? error.message : "Request failed." }));
  }
});

databasePromise
  .then(() => {
    server.listen(port, "0.0.0.0", () => {
      console.log(`Medico Dental API listening on port ${port}`);
    });
  })
  .catch(() => {
    console.error("MongoDB connection failed during startup.");
    process.exitCode = 1;
  });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(async () => {
    await client.close();
    process.exit(0);
  }));
}