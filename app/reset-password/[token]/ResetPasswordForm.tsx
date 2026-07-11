"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "./actions";
import type { AuthFormState } from "@/lib/auth/actions";
import { AuthSubmitButton } from "@/features/auth/components/AuthSubmitButton";
import { FormMessage } from "@/features/auth/components/FormMessage";
import { Input } from "@/src/app/components/ui/input";
import { Label } from "@/src/app/components/ui/label";

const initialState: AuthFormState = { ok: false, message: "" };

export function ResetPasswordForm({ token }: { token: string }) {
  const boundAction = resetPasswordAction.bind(null, token);
  const [state, formAction] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <FormMessage state={state} />
      <AuthSubmitButton>Reset password</AuthSubmitButton>
    </form>
  );
}
