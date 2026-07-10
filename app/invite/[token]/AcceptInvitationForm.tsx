"use client";

import { useActionState } from "react";
import { acceptInvitationAction } from "./actions";
import type { AuthFormState } from "@/lib/auth/actions";
import { AuthSubmitButton } from "@/features/auth/components/AuthSubmitButton";
import { FormMessage } from "@/features/auth/components/FormMessage";
import { Input } from "@/src/app/components/ui/input";
import { Label } from "@/src/app/components/ui/label";

const initialState: AuthFormState = { ok: false, message: "" };

export function AcceptInvitationForm({
  token,
  email,
  isReactivation,
}: {
  token: string;
  email: string;
  isReactivation: boolean;
}) {
  const boundAction = acceptInvitationAction.bind(null, token);
  const [state, formAction] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled readOnly />
      </div>

      {isReactivation ? (
        <p className="text-sm text-slate-500">
          You already have an account with this email. Enter your existing password to rejoin.
        </p>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required minLength={2} />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">{isReactivation ? "Password" : "Create a password"}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isReactivation ? "current-password" : "new-password"}
          required
          minLength={8}
        />
      </div>

      <FormMessage state={state} />
      <AuthSubmitButton>{isReactivation ? "Confirm & join" : "Create account & join"}</AuthSubmitButton>
    </form>
  );
}
