"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerFirstAdminAction, type AuthFormState } from "@/lib/auth/actions";
import { AuthSubmitButton } from "@/features/auth/components/AuthSubmitButton";
import { FormMessage } from "@/features/auth/components/FormMessage";
import { Input } from "@/src/app/components/ui/input";
import { Label } from "@/src/app/components/ui/label";

const initialState: AuthFormState = { ok: false, message: "" };

export function RegisterForm() {
  const [state, formAction] = useActionState(registerFirstAdminAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="organizationName">Organization</Label>
        <Input id="organizationName" name="organizationName" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="defaultCurrency">Currency</Label>
          <Input id="defaultCurrency" name="defaultCurrency" defaultValue="MNT" maxLength={3} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fiscalYearStartMonth">Fiscal month</Label>
          <Input id="fiscalYearStartMonth" name="fiscalYearStartMonth" type="number" min={1} max={12} defaultValue={1} required />
        </div>
      </div>
      <FormMessage state={state} />
      <AuthSubmitButton>Create organization</AuthSubmitButton>
      <Link href="/login" className="text-sm text-blue-600 hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}
