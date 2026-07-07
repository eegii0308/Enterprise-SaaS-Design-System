import { AuthFormShell } from "@/features/auth/components/AuthFormShell";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";
import { t } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  return (
    <AuthFormShell title={t("auth.forgotPassword.title")} subtitle={t("auth.forgotPassword.subtitle")}>
      <ForgotPasswordForm />
    </AuthFormShell>
  );
}
