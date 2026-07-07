import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const sessionCookieName = "ereconcile_session";

export type SessionUser = {
  userId: string;
  email: string;
  fullName: string;
  organizationId: string;
  organizationName: string;
  membershipId: string;
  roleId: string;
  roleName: string;
};

function getSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SESSION_SECRET must be set to at least 32 characters.");
  }

  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function encodeSession(session: SessionUser) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(value: string): SessionUser | null {
  const [payload, signature] = value.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expected = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser;
}

export async function getSession() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(sessionCookieName);

  if (!cookie) {
    return null;
  }

  try {
    return decodeSession(cookie.value);
  } catch {
    return null;
  }
}

export async function setSession(session: SessionUser) {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
}
