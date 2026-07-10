"use server";

import { redirect } from "next/navigation";
import { compare, hash } from "bcryptjs";
import { acceptInvitation, InvitationAcceptError } from "@/lib/invitations/accept";
import { formValue, type AuthFormState } from "@/lib/auth/core";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function acceptInvitationAction(
  token: string,
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fullName = formValue(formData, "fullName");
  const password = formValue(formData, "password");

  let session: { userId: string; membershipId: string };

  try {
    session = await acceptInvitation(
      { token, fullName: fullName || undefined, password },
      {
        prisma,
        hashPassword: (plainPassword) => hash(plainPassword, 12),
        comparePassword: compare,
      },
    );
  } catch (error) {
    if (error instanceof InvitationAcceptError) {
      return { ok: false, message: error.message };
    }

    return { ok: false, message: "Something went wrong. Please try again." };
  }

  await createSession(session.userId, session.membershipId);
  redirect("/dashboard");
}
