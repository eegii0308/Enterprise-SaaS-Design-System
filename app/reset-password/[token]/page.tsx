import Link from "next/link";
import { AuthFormShell } from "@/features/auth/components/AuthFormShell";
import { lookupPasswordResetToken } from "@/lib/auth/password-reset";
import { prisma } from "@/lib/db/client";
import { ResetPasswordForm } from "./ResetPasswordForm";

type ResetPasswordPageProps = {
  params: Promise<{ token: string }>;
};

export default async function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { token } = await params;
  const preview = await lookupPasswordResetToken(token, prisma);

  if (!preview.valid) {
    return (
      <AuthFormShell title="Link not available" subtitle="This password reset link is invalid or has expired.">
        <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
          Request a new link
        </Link>
      </AuthFormShell>
    );
  }

  return (
    <AuthFormShell title="Reset your password" subtitle="Choose a new password for your account.">
      <ResetPasswordForm token={token} />
    </AuthFormShell>
  );
}
