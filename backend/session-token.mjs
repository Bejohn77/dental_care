import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_ISSUER = "medico-dental-care-api";
const TOKEN_AUDIENCE = "medico-dental-care-frontend";

export function signSessionToken(profileId, jti, issuedAt, expiresAt, secret) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: TOKEN_ISSUER,
    aud: TOKEN_AUDIENCE,
    sub: profileId,
    jti,
    iat: issuedAt,
    exp: expiresAt,
  })).toString("base64url");
  const unsignedToken = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(unsignedToken).digest("base64url");
  return `${unsignedToken}.${signature}`;
}

export function verifySessionToken(token, secret, now = Math.floor(Date.now() / 1000)) {
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

  const expected = createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest();
  const actual = Buffer.from(parts[2], "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  if (
    typeof payload.sub !== "string" ||
    typeof payload.jti !== "string" ||
    payload.iss !== TOKEN_ISSUER ||
    payload.aud !== TOKEN_AUDIENCE ||
    !Number.isInteger(payload.exp) ||
    payload.exp <= now ||
    !Number.isInteger(payload.iat) ||
    payload.iat > now + 60
  ) {
    return null;
  }

  return payload;
}
