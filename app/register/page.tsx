import { AuthFormShell } from "@/features/auth/components/AuthFormShell";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export default function RegisterPage() {
  return (
    <AuthFormShell title="Create first organization" subtitle="This one-time setup creates the first Admin membership.">
      <RegisterForm />
    </AuthFormShell>
  );
}
