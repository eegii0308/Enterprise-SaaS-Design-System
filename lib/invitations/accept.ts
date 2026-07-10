import { Prisma } from "@prisma/client";
import { hashInvitationToken } from "../security/tokens.ts";
import type { RoleName } from "../../types/permissions.ts";

export type InvitationAcceptErrorCode = "INVALID_TOKEN" | "VALIDATION" | "CONFLICT" | "INVALID_CREDENTIALS" | "SERVER";

export class InvitationAcceptError extends Error {
  readonly code: InvitationAcceptErrorCode;

  constructor(message: string, code: InvitationAcceptErrorCode) {
    super(message);
    this.name = "InvitationAcceptError";
    this.code = code;
  }
}

type InvitationLookupRecord = {
  id: string;
  organizationId: string;
  email: string;
  status: string;
  expiresAt: Date;
  membershipId: string | null;
  role: { name: string };
  organization: { name: string };
};

type InvitationDetailRecord = {
  id: string;
  organizationId: string;
  email: string;
  roleId: string;
  status: string;
  expiresAt: Date;
  membershipId: string | null;
};

type UserRecord = { id: string; passwordHash: string; status: string };
type MembershipRecord = { id: string; userId: string; status: string };

type AcceptInvitationTransactionClient = {
  invitation: {
    findUnique(args: unknown): Promise<InvitationDetailRecord | null>;
    update(args: unknown): Promise<unknown>;
  };
  user: {
    findUnique(args: unknown): Promise<UserRecord | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
  membership: {
    findUnique(args: unknown): Promise<MembershipRecord | null>;
    update(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<{ id: string }>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
};

export type AcceptInvitationPrisma = {
  invitation: {
    findUnique(args: unknown): Promise<InvitationLookupRecord | null>;
  };
  $transaction<T>(callback: (tx: AcceptInvitationTransactionClient) => Promise<T>): Promise<T>;
};

export type InvitationPreview =
  | {
      valid: true;
      email: string;
      roleName: string;
      organizationName: string;
      isReactivation: boolean;
    }
  | { valid: false };

export async function lookupInvitationByToken(token: string, prisma: AcceptInvitationPrisma): Promise<InvitationPreview> {
  const tokenHash = hashInvitationToken(token);

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      organizationId: true,
      email: true,
      status: true,
      expiresAt: true,
      membershipId: true,
      role: { select: { name: true } },
      organization: { select: { name: true } },
    },
  });

  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= new Date()) {
    return { valid: false };
  }

  return {
    valid: true,
    email: invitation.email,
    roleName: invitation.role.name,
    organizationName: invitation.organization.name,
    isReactivation: invitation.membershipId !== null,
  };
}

export type AcceptInvitationInput = {
  token: string;
  fullName?: string;
  password: string;
};

export type AcceptInvitationResult = {
  userId: string;
  membershipId: string;
};

export type AcceptInvitationDependencies = {
  prisma: { $transaction: AcceptInvitationPrisma["$transaction"] };
  hashPassword(password: string): Promise<string>;
  comparePassword(password: string, passwordHash: string): Promise<boolean>;
};

export async function acceptInvitation(
  input: AcceptInvitationInput,
  deps: AcceptInvitationDependencies,
): Promise<AcceptInvitationResult> {
  if (!input.password || input.password.length < 8) {
    throw new InvitationAcceptError("Password must be at least 8 characters.", "VALIDATION");
  }

  const tokenHash = hashInvitationToken(input.token);

  return deps.prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        organizationId: true,
        email: true,
        roleId: true,
        status: true,
        expiresAt: true,
        membershipId: true,
      },
    });

    if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= new Date()) {
      throw new InvitationAcceptError("This invitation link is invalid or has expired.", "INVALID_TOKEN");
    }

    const acceptedAt = new Date();
    let userId: string;
    let membershipId: string;

    if (invitation.membershipId) {
      // Reactivation branch: the invited email already has a User account
      // and a (previously DISABLED) Membership in this same organization.
      // Confirming their existing password proves identity since they have
      // no usable session -- their membership isn't ACTIVE yet, so they
      // cannot log in through the normal flow until this completes.
      const membership = await tx.membership.findUnique({
        where: { id: invitation.membershipId },
        select: { id: true, userId: true, status: true },
      });

      if (!membership || membership.status !== "INVITED") {
        throw new InvitationAcceptError("This invitation is no longer valid.", "INVALID_TOKEN");
      }

      const user = await tx.user.findUnique({
        where: { id: membership.userId },
        select: { id: true, passwordHash: true, status: true },
      });

      if (!user || user.status !== "ACTIVE") {
        throw new InvitationAcceptError("This account is no longer active.", "INVALID_TOKEN");
      }

      const passwordMatches = await deps.comparePassword(input.password, user.passwordHash);

      if (!passwordMatches) {
        throw new InvitationAcceptError("Incorrect password.", "INVALID_CREDENTIALS");
      }

      await tx.membership.update({
        where: { id: membership.id },
        data: { status: "ACTIVE", joinedAt: acceptedAt },
      });

      userId = user.id;
      membershipId = membership.id;
    } else {
      if (!input.fullName || input.fullName.trim().length < 2) {
        throw new InvitationAcceptError("Full name is required.", "VALIDATION");
      }

      const existingUser = await tx.user.findUnique({ where: { email: invitation.email }, select: { id: true } });

      if (existingUser) {
        throw new InvitationAcceptError("An account with this email already exists. Please log in instead.", "CONFLICT");
      }

      const passwordHash = await deps.hashPassword(input.password);

      const user = await tx.user.create({
        data: {
          email: invitation.email,
          fullName: input.fullName.trim(),
          passwordHash,
        },
      });

      const membership = await tx.membership.create({
        data: {
          organizationId: invitation.organizationId,
          userId: user.id,
          roleId: invitation.roleId,
          status: "ACTIVE",
          joinedAt: acceptedAt,
        },
      });

      userId = user.id;
      membershipId = membership.id;
    }

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAt },
    });

    await tx.auditLog.create({
      data: {
        organizationId: invitation.organizationId,
        actorUserId: userId,
        action: "INVITATION_ACCEPTED",
        resourceType: "invitation",
        resourceId: invitation.id,
        metadata: {
          organizationId: invitation.organizationId,
          userId,
          invitationId: invitation.id,
          email: invitation.email,
          membershipId,
          timestamp: acceptedAt.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return { userId, membershipId };
  });
}
