import { Prisma } from "@prisma/client";
import { generateSecureToken, hashSecureToken } from "../security/tokens.ts";

export type PasswordResetErrorCode = "VALIDATION" | "INVALID_TOKEN";

export class PasswordResetError extends Error {
  readonly code: PasswordResetErrorCode;

  constructor(message: string, code: PasswordResetErrorCode) {
    super(message);
    this.name = "PasswordResetError";
    this.code = code;
  }
}

// Deliberately much shorter than the 7-day invitation TTL: a password-reset
// link grants control over an existing account, so its exposure window
// should be minimal.
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

type ResetUserRecord = { id: string; email: string; fullName: string; status: string };

type RequestPasswordResetTransactionClient = {
  user: {
    findUnique(args: unknown): Promise<ResetUserRecord | null>;
  };
  membership: {
    findFirst(args: unknown): Promise<{ organizationId: string } | null>;
  };
  passwordResetToken: {
    updateMany(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<{ id: string }>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
};

export type RequestPasswordResetPrisma = {
  $transaction<T>(callback: (tx: RequestPasswordResetTransactionClient) => Promise<T>): Promise<T>;
};

export type RequestPasswordResetResult =
  | { sent: true; token: string; email: string; fullName: string; expiresAt: Date }
  | { sent: false };

// Always returns successfully regardless of whether the email matches a real,
// active account -- the caller (forgotPasswordAction) must show the exact
// same message either way to avoid leaking which emails are registered.
// {sent: false} vs {sent: true} is for the caller to decide whether to send
// an email, never to vary the user-facing response.
export async function requestPasswordReset(
  email: string,
  prisma: RequestPasswordResetPrisma,
): Promise<RequestPasswordResetResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const token = generateSecureToken();
  const tokenHash = hashSecureToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, fullName: true, status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      return { sent: false };
    }

    // Only the most recently requested link should ever be usable -- earlier
    // outstanding requests are invalidated the moment a new one is made.
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });

    await tx.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const membership = await tx.membership.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
      select: { organizationId: true },
    });

    // AuditLog.organizationId is required; a user with no active membership
    // (rare -- e.g. disabled mid-flow) simply has no audit trail to attach
    // this event to.
    if (membership) {
      await tx.auditLog.create({
        data: {
          organizationId: membership.organizationId,
          actorUserId: user.id,
          action: "PASSWORD_RESET_REQUESTED",
          resourceType: "user",
          resourceId: user.id,
          metadata: {
            userId: user.id,
            email: user.email,
            timestamp: now.toISOString(),
          } satisfies Prisma.JsonObject,
        },
      });
    }

    return { sent: true, token, email: user.email, fullName: user.fullName, expiresAt };
  });
}

type PasswordResetTokenRecord = { expiresAt: Date; usedAt: Date | null };

export type LookupPasswordResetPrisma = {
  passwordResetToken: {
    findUnique(args: unknown): Promise<PasswordResetTokenRecord | null>;
  };
};

export type PasswordResetTokenPreview = { valid: boolean };

export async function lookupPasswordResetToken(
  token: string,
  prisma: LookupPasswordResetPrisma,
): Promise<PasswordResetTokenPreview> {
  const tokenHash = hashSecureToken(token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { expiresAt: true, usedAt: true },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
    return { valid: false };
  }

  return { valid: true };
}

type ResetPasswordTokenDetailRecord = { id: string; userId: string; expiresAt: Date; usedAt: Date | null };
type ResetPasswordUserRecord = { id: string; status: string };

type ResetPasswordTransactionClient = {
  passwordResetToken: {
    findUnique(args: unknown): Promise<ResetPasswordTokenDetailRecord | null>;
    update(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<unknown>;
  };
  user: {
    findUnique(args: unknown): Promise<ResetPasswordUserRecord | null>;
    update(args: unknown): Promise<unknown>;
  };
  membership: {
    findFirst(args: unknown): Promise<{ organizationId: string } | null>;
  };
  session: {
    updateMany(args: unknown): Promise<unknown>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
};

export type ResetPasswordDependencies = {
  prisma: { $transaction<T>(callback: (tx: ResetPasswordTransactionClient) => Promise<T>): Promise<T> };
  hashPassword(password: string): Promise<string>;
};

export type ResetPasswordInput = {
  token: string;
  newPassword: string;
};

export type ResetPasswordResult = {
  userId: string;
};

export async function resetPassword(
  input: ResetPasswordInput,
  deps: ResetPasswordDependencies,
): Promise<ResetPasswordResult> {
  if (!input.newPassword || input.newPassword.length < 8) {
    throw new PasswordResetError("Password must be at least 8 characters.", "VALIDATION");
  }

  const tokenHash = hashSecureToken(input.token);
  const now = new Date();

  return deps.prisma.$transaction(async (tx) => {
    const resetToken = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now) {
      throw new PasswordResetError("This password reset link is invalid or has expired.", "INVALID_TOKEN");
    }

    const user = await tx.user.findUnique({
      where: { id: resetToken.userId },
      select: { id: true, status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      throw new PasswordResetError("This password reset link is invalid or has expired.", "INVALID_TOKEN");
    }

    const passwordHash = await deps.hashPassword(input.newPassword);

    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });

    await tx.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: now },
    });

    // Belt-and-suspenders: invalidate any other outstanding tokens for this
    // user too (requestPasswordReset already does this on each new request,
    // so in practice there should be at most one PENDING token, but this
    // closes the window on the off chance one slipped through).
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, id: { not: resetToken.id } },
      data: { usedAt: now },
    });

    // A password reset should force re-authentication everywhere, in case
    // the account was compromised -- mirrors clearSession()'s revocation in
    // lib/auth/session.ts.
    await tx.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    });

    const membership = await tx.membership.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
      select: { organizationId: true },
    });

    if (membership) {
      await tx.auditLog.create({
        data: {
          organizationId: membership.organizationId,
          actorUserId: user.id,
          action: "PASSWORD_RESET_COMPLETED",
          resourceType: "user",
          resourceId: user.id,
          metadata: {
            userId: user.id,
            timestamp: now.toISOString(),
          } satisfies Prisma.JsonObject,
        },
      });
    }

    return { userId: user.id };
  });
}
