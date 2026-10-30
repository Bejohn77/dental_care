import { MongoClient } from "mongodb";
import { ensureAdminAccount, getAdminCredentials } from "../admin-bootstrap.mjs";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB;
const credentials = getAdminCredentials();

if (!uri || !databaseName) {
  throw new Error("MONGODB_URI and MONGODB_DB are required to create the admin account.");
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const database = client.db(databaseName);
  await Promise.all([
    database.collection("users").createIndex({ email: 1 }, { unique: true }),
    database.collection("profiles").createIndex({ id: 1 }, { unique: true }),
  ]);
  const created = await ensureAdminAccount(database, credentials);
  console.log(created ? "Admin account created." : "Admin account is already configured.");
} finally {
  await client.close();
}
