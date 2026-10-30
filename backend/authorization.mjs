export function isAdmin(session) {
  return session.role === "admin" || session.role === "admin_doctor";
}

export function authorizeDatabaseQuery(input, session) {
  const table = input.table;
  const action = input.action ?? "find";
  const adminOnly =
    table === "profiles" ||
    table === "doctor_schedules" ||
    (["doctors", "services"].includes(table) && action !== "find") ||
    (table === "appointments" && action === "find" && !Object.keys(input.filters ?? {}).length);

  if (adminOnly && !isAdmin(session)) {
    const error = new Error("Administrator access is required for this request.");
    error.status = 403;
    throw error;
  }

  return isAdmin(session) || !["doctors", "services"].includes(table);
}
