import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { requirePermissionWith, requireSessionWith } from "@/lib/permissions/authorize-core";
import type { Permission } from "@/types/permissions";

function redirectToLogin(): never {
  redirect("/login");
}

export async function requireSession() {
  return requireSessionWith(getSession, redirectToLogin);
}

export async function requirePermission(permission: Permission) {
  return requirePermissionWith(permission, getSession, redirectToLogin);
}
