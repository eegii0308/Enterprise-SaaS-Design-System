"use server";

import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { resetPassword, PasswordResetError } from "@/lib/auth/password-reset";
import { formValue, type AuthFormState } from "@/lib/auth/core";
import { prisma } from "@/lib/db/client";

export async function resetPasswordAction(
  token: string,
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const newPassword = formValue(formData, "password");
  const confirmPassword = formValue(formData, "confirmPassword");

  if (newPassword !== confirmPassword) {
    return { ok: false, message: "Passwords do not match." };
  }

  try {
    await resetPassword(
      { token, newPassword },
      {
        prisma,
        hashPassword: (plainPassword) => hash(plainPassword, 12),
      },
    );
  } catch (error) {
    if (error instanceof PasswordResetError) {
      return { ok: false, message: error.message };
    }

    return { ok: false, message: "Something went wrong. Please try again." };
  }

  redirect("/login?reset=success");
}
