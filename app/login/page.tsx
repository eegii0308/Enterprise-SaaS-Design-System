import { AuthFormShell } from "@/features/auth/components/AuthFormShell";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { t } from "@/lib/i18n";

type LoginPageProps = {
  searchParams: Promise<{ reset?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { reset } = await searchParams;

  return (
    <AuthFormShell title={t("auth.signIn.title")} subtitle={t("auth.signIn.subtitle")}>
      {reset === "success" ? (
        <p className="mb-4 text-sm text-emerald-700" role="status">
          Your password has been reset. Sign in with your new password.
        </p>
      ) : null}
      <LoginForm />
    </AuthFormShell>
  );
}
