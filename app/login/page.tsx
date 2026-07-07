import { AuthFormShell } from "@/features/auth/components/AuthFormShell";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { t } from "@/lib/i18n";

export default function LoginPage() {
  return (
    <AuthFormShell title={t("auth.signIn.title")} subtitle={t("auth.signIn.subtitle")}>
      <LoginForm />
    </AuthFormShell>
  );
}
