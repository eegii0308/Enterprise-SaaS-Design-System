import { AuthFormShell } from "@/features/auth/components/AuthFormShell";
import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { t } from "@/lib/i18n";

export default function RegisterPage() {
  return (
    <AuthFormShell title={t("auth.register.title")} subtitle={t("auth.register.subtitle")}>
      <RegisterForm />
    </AuthFormShell>
  );
}
