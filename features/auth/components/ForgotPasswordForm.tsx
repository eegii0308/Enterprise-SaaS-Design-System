"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, type AuthFormState } from "@/lib/auth/actions";
import { AuthSubmitButton } from "@/features/auth/components/AuthSubmitButton";
import { FormMessage } from "@/features/auth/components/FormMessage";
import { t } from "@/lib/i18n";
import { Input } from "@/src/app/components/ui/input";
import { Label } from "@/src/app/components/ui/label";

const initialState: AuthFormState = { ok: false, message: "" };

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.fields.email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <FormMessage state={state} />
      <AuthSubmitButton>{t("auth.forgotPassword.button")}</AuthSubmitButton>
      <Link href="/login" className="text-sm text-blue-600 hover:underline">
        {t("auth.forgotPassword.backToSignIn")}
      </Link>
    </form>
  );
}
