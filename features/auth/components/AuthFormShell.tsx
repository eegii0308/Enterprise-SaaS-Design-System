import { Building2 } from "lucide-react";
import { t } from "@/lib/i18n";

export function AuthFormShell({
  title,
  subtitle,
  children,
}: Readonly<{
  title: string;
  subtitle: string;
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <section className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <Building2 size={20} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{t("app.name")}</p>
            <p className="text-xs text-slate-500">{t("app.workspace")}</p>
          </div>
        </div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500 mt-1 mb-5">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}
