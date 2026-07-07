import { AuthFormShell } from "@/features/auth/components/AuthFormShell";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthFormShell title="Reset password" subtitle="Request a reset link for an active account.">
      <ForgotPasswordForm />
    </AuthFormShell>
  );
}
