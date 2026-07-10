import { Prisma } from "@prisma/client";
import { prisma } from "../db/client.ts";
import { generateInvitationToken, hashInvitationToken } from "../security/tokens.ts";
import type { RoleName } from "../../types/permissions.ts";

export type InvitationErrorCode = "VALIDATION" | "FORBIDDEN" | "CONFLICT" | "SERVER";

export class InvitationError extends Error {
  readonly code: InvitationErrorCode;

  constructor(message: string, code: InvitationErrorCode) {
    super(message);
    this.name = "InvitationError";
    this.code = code;
  }
}

// Pending invitations are usable for 7 days before a resend is required.
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// A resend cannot be repeated more than once every 60 seconds, to keep an
// admin from accidentally hammering the (currently unmetered) email send.
const RESEND_COOLDOWN_MS = 60 * 1000;

type InvitationContext = {
  organizationId: string;
  userId: string;
};

export type CreateInvitationInput = {
  email: string;
  roleName: RoleName;
};

export type CancelInvitationInput = {
  invitationId: string;
};

export type ResendInvitationInput = {
  invitationId: string;
};

export type CreateInvitationResult = {
  invitationId: string;
  token: string;
  email: string;
  roleName: RoleName;
  expiresAt: Date;
};

export type ResendInvitationResult = {
  invitationId: string;
  token: string;
  email: string;
  roleName: RoleName;
  expiresAt: Date;
};

export type CancelInvitationResult = {
  invitationId: string;
};

type InvitationRecord = {
  id: string;
  organizationId: string;
  email: string;
  status: string;
  membershipId: string | null;
  updatedAt: Date;
  roleId?: string;
};

type RoleRecord = { id: string; name: string };

type InvitationTransactionClient = {
  user: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
  };
  role: {
    findUnique(args: unknown): Promise<RoleRecord | null>;
  };
  membership: {
    findUnique(args: unknown): Promise<{ id: string; status: string } | null>;
    update(args: unknown): Promise<unknown>;
  };
  invitation: {
    findFirst(args: unknown): Promise<InvitationRecord | null>;
    findUnique(args: unknown): Promise<InvitationRecord | null>;
    create(args: unknown): Promise<{ id: string }>;
    update(args: unknown): Promise<unknown>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
};

export type InvitationDatabase = {
  $transaction<T>(callback: (tx: InvitationTransactionClient) => Promise<T>): Promise<T>;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validateEmail(email: string) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new InvitationError("A valid email address is required.", "VALIDATION");
  }
}

function assertInvitationAccess(
  invitation: InvitationRecord | null,
  invitationId: string,
  organizationId: string,
): asserts invitation is InvitationRecord {
  if (!invitation) {
    throw new InvitationError(`Invitation ${invitationId} was not found.`, "VALIDATION");
  }

  if (invitation.organizationId !== organizationId) {
    throw new InvitationError("Invitation does not belong to the current organization.", "FORBIDDEN");
  }
}

export async function createInvitation(
  input: CreateInvitationInput,
  context: InvitationContext,
  database: InvitationDatabase = prisma as unknown as InvitationDatabase,
): Promise<CreateInvitationResult> {
  const email = normalizeEmail(input.email);
  validateEmail(email);

  const token = generateInvitationToken();
  const tokenHash = hashInvitationToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);

  return database.$transaction(async (tx) => {
    const role = await tx.role.findUnique({
      where: { organizationId_name: { organizationId: context.organizationId, name: input.roleName } },
      select: { id: true, name: true },
    });

    if (!role) {
      throw new InvitationError(`Role ${input.roleName} was not found for this organization.`, "VALIDATION");
    }

    const existingUser = await tx.user.findUnique({ where: { email }, select: { id: true } });

    let membershipId: string | null = null;

    if (existingUser) {
      const existingMembership = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId: context.organizationId, userId: existingUser.id } },
        select: { id: true, status: true },
      });

      if (!existingMembership) {
        // The email belongs to a user who is a member of a different
        // organization. Phase 9A only supports single-organization
        // membership (see createSessionForUser in lib/auth/actions.ts, which
        // fails login for any user with more than one ACTIVE membership), so
        // adding them to a second org here would silently break their
        // ability to sign in.
        throw new InvitationError(
          "This email is already registered to an account in another organization and cannot be invited here.",
          "CONFLICT",
        );
      }

      if (existingMembership.status === "ACTIVE") {
        throw new InvitationError("This person is already a member of this organization.", "CONFLICT");
      }

      if (existingMembership.status === "INVITED") {
        throw new InvitationError("An invitation is already pending for this email.", "CONFLICT");
      }

      // DISABLED: reactivating an existing (removed) membership in this same
      // organization is safe -- it never results in a second ACTIVE
      // membership for the user.
      membershipId = existingMembership.id;
    } else {
      const pending = await tx.invitation.findFirst({
        where: { organizationId: context.organizationId, email, status: "PENDING" },
        select: { id: true, organizationId: true, email: true, status: true, membershipId: true, updatedAt: true },
      });

      if (pending) {
        throw new InvitationError("An invitation is already pending for this email.", "CONFLICT");
      }
    }

    const invitation = await tx.invitation.create({
      data: {
        organizationId: context.organizationId,
        email,
        roleId: role.id,
        invitedByUserId: context.userId,
        membershipId,
        tokenHash,
        status: "PENDING",
        expiresAt,
      },
      select: { id: true },
    });

    if (membershipId) {
      await tx.membership.update({
        where: { id: membershipId },
        data: { status: "INVITED", invitedAt: now, roleId: role.id },
      });
    }

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "INVITATION_SENT",
        resourceType: "invitation",
        resourceId: invitation.id,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          invitationId: invitation.id,
          email,
          roleName: role.name,
          reactivatedMembershipId: membershipId,
          timestamp: now.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return { invitationId: invitation.id, token, email, roleName: input.roleName, expiresAt };
  });
}

export async function cancelInvitation(
  input: CancelInvitationInput,
  context: InvitationContext,
  database: InvitationDatabase = prisma as unknown as InvitationDatabase,
): Promise<CancelInvitationResult> {
  if (!input.invitationId) {
    throw new InvitationError("invitationId is required.", "VALIDATION");
  }

  return database.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({
      where: { id: input.invitationId },
      select: { id: true, organizationId: true, email: true, status: true, membershipId: true, updatedAt: true },
    });

    assertInvitationAccess(invitation, input.invitationId, context.organizationId);

    if (invitation.status !== "PENDING") {
      throw new InvitationError("Only pending invitations can be cancelled.", "CONFLICT");
    }

    const cancelledAt = new Date();

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "REVOKED", revokedAt: cancelledAt },
    });

    if (invitation.membershipId) {
      await tx.membership.update({
        where: { id: invitation.membershipId },
        data: { status: "DISABLED" },
      });
    }

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "INVITATION_CANCELLED",
        resourceType: "invitation",
        resourceId: invitation.id,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          invitationId: invitation.id,
          email: invitation.email,
          timestamp: cancelledAt.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return { invitationId: invitation.id };
  });
}

export async function resendInvitation(
  input: ResendInvitationInput,
  context: InvitationContext,
  database: InvitationDatabase = prisma as unknown as InvitationDatabase,
): Promise<ResendInvitationResult> {
  if (!input.invitationId) {
    throw new InvitationError("invitationId is required.", "VALIDATION");
  }

  const token = generateInvitationToken();
  const tokenHash = hashInvitationToken(token);

  return database.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({
      where: { id: input.invitationId },
      select: {
        id: true,
        organizationId: true,
        email: true,
        status: true,
        membershipId: true,
        updatedAt: true,
        roleId: true,
      },
    });

    assertInvitationAccess(invitation, input.invitationId, context.organizationId);

    if (invitation.status !== "PENDING") {
      throw new InvitationError("Only pending invitations can be resent.", "CONFLICT");
    }

    const now = new Date();

    if (now.getTime() - invitation.updatedAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new InvitationError("Please wait a moment before resending this invitation.", "CONFLICT");
    }

    const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);

    const role = await tx.role.findUnique({
      where: { id: invitation.roleId },
      select: { id: true, name: true },
    });

    if (!role) {
      throw new InvitationError("The role assigned to this invitation no longer exists.", "SERVER");
    }

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { tokenHash, expiresAt },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "INVITATION_RESENT",
        resourceType: "invitation",
        resourceId: invitation.id,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          invitationId: invitation.id,
          email: invitation.email,
          timestamp: now.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return { invitationId: invitation.id, token, email: invitation.email, roleName: role.name as RoleName, expiresAt };
  });
}
