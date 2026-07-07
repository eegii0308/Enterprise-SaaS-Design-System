"use client";

import type { AuthFormState } from "@/lib/auth/actions";

export function FormMessage({ state }: Readonly<{ state: AuthFormState }>) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}
      role={state.ok ? "status" : "alert"}
    >
      {state.message}
    </p>
  );
}
