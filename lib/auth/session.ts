import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db/client";

const sessionCookieName = "ereconcile_session";
const sessionMaxAgeSeconds = 60 * 60 * 8;

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

function encodeSessionId(sessionId: string) {
  return `${sessionId}.${sign(sessionId)}`;
}

function decodeSessionId(value: string): string | null {
  const [sessionId, signature] = value.split(".");

  if (!sessionId || !signature) {
    return null;
  }

  const expected = sign(sessionId);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  return sessionId;
}

async function loadSessionUser(sessionId: string): Promise<SessionUser | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      membership: {
        include: {
          organization: true,
          role: true,
          user: true,
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    return null;
  }

  const { membership } = session;

  if (membership.status !== "ACTIVE" || membership.user.status !== "ACTIVE") {
    return null;
  }

  if (membership.role.organizationId !== membership.organizationId) {
    return null;
  }

  return {
    userId: membership.user.id,
    email: membership.user.email,
    fullName: membership.user.fullName,
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    membershipId: membership.id,
    roleId: membership.role.id,
    roleName: membership.role.name,
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(sessionCookieName);

  if (!cookie) {
    return null;
  }

  try {
    const sessionId = decodeSessionId(cookie.value);
    return sessionId ? loadSessionUser(sessionId) : null;
  } catch {
    return null;
  }
}

export async function createSession(userId: string, membershipId: string) {
  const session = await prisma.session.create({
    data: {
      userId,
      membershipId,
      expiresAt: new Date(Date.now() + sessionMaxAgeSeconds * 1000),
    },
  });

  await setSessionId(session.id);
}

export async function setSessionId(sessionId: string) {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, encodeSessionId(sessionId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(sessionCookieName);
  const sessionId = cookie ? decodeSessionId(cookie.value) : null;

  if (sessionId) {
    await prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  cookieStore.delete(sessionCookieName);
}
