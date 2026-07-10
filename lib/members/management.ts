import { Prisma } from "@prisma/client";
import { prisma } from "../db/client.ts";
import type { RoleName } from "../../types/permissions.ts";

export type MemberErrorCode = "VALIDATION" | "FORBIDDEN" | "CONFLICT" | "SERVER";

export class MemberError extends Error {
  readonly code: MemberErrorCode;

  constructor(message: string, code: MemberErrorCode) {
    super(message);
    this.name = "MemberError";
    this.code = code;
  }
}

type MemberContext = {
  organizationId: string;
  userId: string;
};

type MembershipRecord = {
  id: string;
  organizationId: string;
  userId: string;
  roleId: string;
  status: string;
  role: { name: string };
};

type RoleRecord = { id: string; name: string };

type MemberTransactionClient = {
  membership: {
    findUnique(args: unknown): Promise<MembershipRecord | null>;
    update(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<{ count: number }>;
    count(args: unknown): Promise<number>;
  };
  role: {
    findUnique(args: unknown): Promise<RoleRecord | null>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
};

export type MemberDatabase = {
  $transaction<T>(callback: (tx: MemberTransactionClient) => Promise<T>): Promise<T>;
};

export type ChangeMemberRoleInput = {
  membershipId: string;
  roleName: RoleName;
};

export type DisableMemberInput = {
  membershipId: string;
};

export type ReactivateMemberInput = {
  membershipId: string;
};

export type MemberResult = {
  membershipId: string;
  status: string;
};

function assertMembershipAccess(
  membership: MembershipRecord | null,
  membershipId: string,
  organizationId: string,
): asserts membership is MembershipRecord {
  if (!membership) {
    throw new MemberError(`Membership ${membershipId} was not found.`, "VALIDATION");
  }

  if (membership.organizationId !== organizationId) {
    throw new MemberError("Membership does not belong to the current organization.", "FORBIDDEN");
  }
}

async function assertNotLastActiveAdmin(tx: MemberTransactionClient, organizationId: string, membership: MembershipRecord) {
  if (membership.role.name !== "ADMIN" || membership.status !== "ACTIVE") {
    return;
  }

  const activeAdminCount = await tx.membership.count({
    where: { organizationId, status: "ACTIVE", role: { name: "ADMIN" } },
  });

  if (activeAdminCount <= 1) {
    throw new MemberError("The organization must have at least one active admin.", "CONFLICT");
  }
}

export async function changeMemberRole(
  input: ChangeMemberRoleInput,
  context: MemberContext,
  database: MemberDatabase = prisma as unknown as MemberDatabase,
): Promise<MemberResult> {
  if (!input.membershipId) {
    throw new MemberError("membershipId is required.", "VALIDATION");
  }

  return database.$transaction(async (tx) => {
    const membership = await tx.membership.findUnique({
      where: { id: input.membershipId },
      select: {
        id: true,
        organizationId: true,
        userId: true,
        roleId: true,
        status: true,
        role: { select: { name: true } },
      },
    });

    assertMembershipAccess(membership, input.membershipId, context.organizationId);

    if (membership.status !== "ACTIVE") {
      throw new MemberError("Only active members can have their role changed.", "CONFLICT");
    }

    if (membership.role.name === input.roleName) {
      return { membershipId: membership.id, status: membership.status };
    }

    await assertNotLastActiveAdmin(tx, context.organizationId, membership);

    const role = await tx.role.findUnique({
      where: { organizationId_name: { organizationId: context.organizationId, name: input.roleName } },
      select: { id: true, name: true },
    });

    if (!role) {
      throw new MemberError(`Role ${input.roleName} was not found for this organization.`, "VALIDATION");
    }

    await tx.membership.update({
      where: { id: membership.id },
      data: { roleId: role.id },
    });

    const changedAt = new Date();
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "MEMBER_ROLE_CHANGED",
        resourceType: "membership",
        resourceId: membership.id,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          membershipId: membership.id,
          targetUserId: membership.userId,
          oldRoleName: membership.role.name,
          newRoleName: role.name,
          timestamp: changedAt.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return { membershipId: membership.id, status: membership.status };
  });
}

export async function disableMember(
  input: DisableMemberInput,
  context: MemberContext,
  database: MemberDatabase = prisma as unknown as MemberDatabase,
): Promise<MemberResult> {
  if (!input.membershipId) {
    throw new MemberError("membershipId is required.", "VALIDATION");
  }

  return database.$transaction(async (tx) => {
    const membership = await tx.membership.findUnique({
      where: { id: input.membershipId },
      select: {
        id: true,
        organizationId: true,
        userId: true,
        roleId: true,
        status: true,
        role: { select: { name: true } },
      },
    });

    assertMembershipAccess(membership, input.membershipId, context.organizationId);

    if (membership.userId === context.userId) {
      throw new MemberError("You cannot disable your own membership.", "VALIDATION");
    }

    if (membership.status !== "ACTIVE") {
      throw new MemberError("Only active members can be disabled.", "CONFLICT");
    }

    await assertNotLastActiveAdmin(tx, context.organizationId, membership);

    // CAS: only disables if the membership is still active at write time, so
    // a concurrent disable request cannot double-apply.
    const disableResult = await tx.membership.updateMany({
      where: { id: membership.id, organizationId: context.organizationId, status: "ACTIVE" },
      data: { status: "DISABLED" },
    });

    if (disableResult.count === 0) {
      throw new MemberError("Membership changed before it could be disabled. Please retry.", "CONFLICT");
    }

    const disabledAt = new Date();
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "MEMBER_DISABLED",
        resourceType: "membership",
        resourceId: membership.id,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          membershipId: membership.id,
          targetUserId: membership.userId,
          timestamp: disabledAt.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return { membershipId: membership.id, status: "DISABLED" };
  });
}

export async function reactivateMember(
  input: ReactivateMemberInput,
  context: MemberContext,
  database: MemberDatabase = prisma as unknown as MemberDatabase,
): Promise<MemberResult> {
  if (!input.membershipId) {
    throw new MemberError("membershipId is required.", "VALIDATION");
  }

  return database.$transaction(async (tx) => {
    const membership = await tx.membership.findUnique({
      where: { id: input.membershipId },
      select: {
        id: true,
        organizationId: true,
        userId: true,
        roleId: true,
        status: true,
        role: { select: { name: true } },
      },
    });

    assertMembershipAccess(membership, input.membershipId, context.organizationId);

    if (membership.status !== "DISABLED") {
      throw new MemberError("Only disabled members can be reactivated.", "CONFLICT");
    }

    const reactivateResult = await tx.membership.updateMany({
      where: { id: membership.id, organizationId: context.organizationId, status: "DISABLED" },
      data: { status: "ACTIVE", joinedAt: new Date() },
    });

    if (reactivateResult.count === 0) {
      throw new MemberError("Membership changed before it could be reactivated. Please retry.", "CONFLICT");
    }

    const reactivatedAt = new Date();
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "MEMBER_REACTIVATED",
        resourceType: "membership",
        resourceId: membership.id,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          membershipId: membership.id,
          targetUserId: membership.userId,
          timestamp: reactivatedAt.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return { membershipId: membership.id, status: "ACTIVE" };
  });
}
