"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type AuthFormState } from "@/lib/auth/actions";
import { AuthSubmitButton } from "@/features/auth/components/AuthSubmitButton";
import { FormMessage } from "@/features/auth/components/FormMessage";
import { t } from "@/lib/i18n";
import { Input } from "@/src/app/components/ui/input";
import { Label } from "@/src/app/components/ui/label";

const initialState: AuthFormState = { ok: false, message: "" };

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.fields.email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("auth.fields.password")}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} />
      </div>
      <FormMessage state={state} />
      <AuthSubmitButton>{t("auth.signIn.button")}</AuthSubmitButton>
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-blue-600 hover:underline">
          {t("auth.signIn.forgotPassword")}
        </Link>
        <Link href="/register" className="text-blue-600 hover:underline">
          {t("auth.signIn.firstAdminSetup")}
        </Link>
      </div>
    </form>
  );
}
