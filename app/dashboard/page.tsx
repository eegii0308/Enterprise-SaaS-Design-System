import { ArrowLeftRight, Building2, CheckCircle2, FileText, ShieldCheck, Upload, Users } from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { requireSession } from "@/lib/permissions/authorize";
import { fixedRoleLabels, rolePermissions } from "@/lib/permissions/roles";
import { Button } from "@/src/app/components/ui/button";
import type { RoleName } from "@/types/permissions";

export default async function DashboardPage() {
  const session = await requireSession();
  const roleName = session.roleName as RoleName;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Building2 size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="font-bold text-slate-900">E-Reconcile MN</p>
              <p className="text-xs text-slate-500">{session.organizationName}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <section className="p-6 space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Signed in as {session.fullName} with {fixedRoleLabels[roleName]} access.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Organization", value: session.organizationName, icon: Building2 },
            { label: "Active role", value: fixedRoleLabels[roleName], icon: ShieldCheck },
            { label: "Permissions", value: rolePermissions[roleName].length.toString(), icon: CheckCircle2 },
            { label: "Phase", value: "Tenant foundation", icon: ArrowLeftRight },
          ].map((item) => (
            <article key={item.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">{item.label}</p>
                <item.icon size={16} className="text-blue-600" aria-hidden="true" />
              </div>
              <p className="text-lg font-bold text-slate-900 mt-2 truncate">{item.value}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "Import transactions",
              description: "CSV/XLSX import will attach to this organization context in Phase 2.",
              icon: Upload,
            },
            {
              title: "Review reconciliation",
              description: "Manual matching and approval routes will use the same server-side session guard.",
              icon: ArrowLeftRight,
            },
            {
              title: "Manage access",
              description: "Fixed Admin, Finance Manager, Accountant, Auditor, and Viewer roles are seeded per tenant.",
              icon: Users,
            },
          ].map((item) => (
            <article key={item.title} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <item.icon size={18} className="text-blue-600" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900 mt-3">{item.title}</h2>
              <p className="text-sm text-slate-500 mt-1">{item.description}</p>
            </article>
          ))}
        </div>

        <section className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            <FileText size={16} className="text-blue-600" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900">Granted Permissions</h2>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {rolePermissions[roleName].map((permission) => (
              <span key={permission} className="text-xs bg-slate-100 text-slate-700 rounded-full px-2.5 py-1">
                {permission}
              </span>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
