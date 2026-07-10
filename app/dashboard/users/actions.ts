"use server";

import { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/permissions/authorize";
import { createInvitation, cancelInvitation, resendInvitation, InvitationError } from "@/lib/invitations/management";
import { changeMemberRole, disableMember, reactivateMember, MemberError } from "@/lib/members/management";
import { sendEmail } from "@/lib/email/client";
import { buildInvitationEmail } from "@/lib/email/templates/invitation";
import { fixedRoleLabels } from "@/lib/permissions/roles";
import { inviteMemberSchema } from "@/lib/validations/invitations";
import type { RoleName } from "@/types/permissions";

type ActionState =
  | { ok: true; message: string }
  | { ok: false; message: string; code: string };

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function assertAppBaseUrlConfigured() {
  if (!process.env.APP_BASE_URL) {
    throw new Error("APP_BASE_URL must be set to build invitation links.");
  }
}

function buildAcceptUrl(token: string) {
  // Presence is checked by assertAppBaseUrlConfigured() before any invitation
  // is created or resent, so this never has to fail after a DB write has
  // already happened.
  return `${process.env.APP_BASE_URL}/invite/${token}`;
}

export async function inviteMemberAction(input: { email: string; roleName: RoleName }): Promise<ActionState> {
  const session = await requirePermission("users.manage");

  const parsed = inviteMemberSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid invitation details.", code: "VALIDATION" };
  }

  try {
    assertAppBaseUrlConfigured();

    const invitation = await createInvitation(parsed.data, {
      organizationId: session.organizationId,
      userId: session.userId,
    });

    const { subject, html, text } = buildInvitationEmail({
      organizationName: session.organizationName,
      roleLabel: fixedRoleLabels[invitation.roleName],
      inviterName: session.fullName,
      acceptUrl: buildAcceptUrl(invitation.token),
      expiresAt: invitation.expiresAt,
    });

    try {
      await sendEmail({ to: invitation.email, subject, html, text });
    } catch {
      return {
        ok: true,
        message: "Invitation created, but the email could not be sent. Use \"Resend\" to try again.",
      };
    }

    return { ok: true, message: "Invitation sent." };
  } catch (error) {
    if (error instanceof InvitationError) {
      return { ok: false, message: error.message, code: error.code };
    }

    if (isUniqueConstraintError(error)) {
      return { ok: false, message: "An invitation is already pending for this email.", code: "CONFLICT" };
    }

    return { ok: false, message: "Invitation could not be created.", code: "SERVER" };
  }
}

export async function cancelInvitationAction(input: { invitationId: string }): Promise<ActionState> {
  const session = await requirePermission("users.manage");

  try {
    await cancelInvitation(input, { organizationId: session.organizationId, userId: session.userId });
    return { ok: true, message: "Invitation cancelled." };
  } catch (error) {
    if (error instanceof InvitationError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return { ok: false, message: "Invitation could not be cancelled.", code: "SERVER" };
  }
}

export async function resendInvitationAction(input: { invitationId: string }): Promise<ActionState> {
  const session = await requirePermission("users.manage");

  try {
    assertAppBaseUrlConfigured();

    const invitation = await resendInvitation(input, {
      organizationId: session.organizationId,
      userId: session.userId,
    });

    const { subject, html, text } = buildInvitationEmail({
      organizationName: session.organizationName,
      roleLabel: fixedRoleLabels[invitation.roleName],
      inviterName: session.fullName,
      acceptUrl: buildAcceptUrl(invitation.token),
      expiresAt: invitation.expiresAt,
    });

    try {
      await sendEmail({ to: invitation.email, subject, html, text });
    } catch {
      return {
        ok: true,
        message: "Invitation link refreshed, but the email could not be sent. Try again shortly.",
      };
    }

    return { ok: true, message: "Invitation resent." };
  } catch (error) {
    if (error instanceof InvitationError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return { ok: false, message: "Invitation could not be resent.", code: "SERVER" };
  }
}

export async function changeMemberRoleAction(input: { membershipId: string; roleName: RoleName }): Promise<ActionState> {
  const session = await requirePermission("users.manage");

  try {
    await changeMemberRole(input, { organizationId: session.organizationId, userId: session.userId });
    return { ok: true, message: "Role updated." };
  } catch (error) {
    if (error instanceof MemberError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return { ok: false, message: "Role could not be updated.", code: "SERVER" };
  }
}

export async function disableMemberAction(input: { membershipId: string }): Promise<ActionState> {
  const session = await requirePermission("users.manage");

  try {
    await disableMember(input, { organizationId: session.organizationId, userId: session.userId });
    return { ok: true, message: "Member disabled." };
  } catch (error) {
    if (error instanceof MemberError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return { ok: false, message: "Member could not be disabled.", code: "SERVER" };
  }
}

export async function reactivateMemberAction(input: { membershipId: string }): Promise<ActionState> {
  const session = await requirePermission("users.manage");

  try {
    await reactivateMember(input, { organizationId: session.organizationId, userId: session.userId });
    return { ok: true, message: "Member reactivated." };
  } catch (error) {
    if (error instanceof MemberError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return { ok: false, message: "Member could not be reactivated.", code: "SERVER" };
  }
}
