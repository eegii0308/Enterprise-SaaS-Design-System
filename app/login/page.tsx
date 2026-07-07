import { AuthFormShell } from "@/features/auth/components/AuthFormShell";
import { LoginForm } from "@/features/auth/components/LoginForm";

export default function LoginPage() {
  return (
    <AuthFormShell title="Sign in" subtitle="Use your organization account to continue.">
      <LoginForm />
    </AuthFormShell>
  );
}
