import Link from "next/link";
import {
  Building2,
  ClipboardList,
  FileClock,
  FileText,
  Gauge,
  Landmark,
  ListChecks,
  Settings,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { requireSession } from "@/lib/permissions/authorize";
import { t } from "@/lib/i18n";
import { Button } from "@/src/app/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/src/app/components/ui/sidebar";

const navigationItems = [
  { label: t("navigation.dashboard"), href: "/dashboard", icon: Gauge },
  { label: t("navigation.transactions"), href: "/dashboard/transactions", icon: Landmark },
  { label: t("navigation.imports"), href: "/dashboard/imports", icon: Upload },
  { label: t("navigation.reconciliation"), href: "/dashboard/reconciliation", icon: ListChecks },
  { label: t("navigation.bankAccounts"), href: "/dashboard/bank-accounts", icon: Building2 },
  { label: t("navigation.matchingRules"), href: "/dashboard/matching-rules", icon: ClipboardList },
  { label: t("navigation.reports"), href: "/dashboard/reports", icon: FileText },
  { label: t("navigation.auditLogs"), href: "/dashboard/audit-logs", icon: FileClock },
  { label: t("navigation.users"), href: "/dashboard/users", icon: Users },
  { label: t("navigation.settings"), href: "/dashboard/settings", icon: Settings },
];

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-slate-200 bg-white">
        <SidebarHeader className="border-b border-slate-200 p-4">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-bold text-slate-950">{t("app.name")}</p>
              <p className="truncate text-xs text-slate-500">{session.organizationName}</p>
            </div>
          </Link>
        </SidebarHeader>

        <SidebarContent className="bg-white">
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigationItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild tooltip={item.label}>
                      <Link href={item.href}>
                        <item.icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarSeparator />
        <SidebarFooter className="p-4">
          <div className="min-w-0 rounded-md bg-slate-50 p-3 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium text-slate-950">{session.fullName}</p>
            <p className="truncate text-xs text-slate-500">{session.email}</p>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" className="w-full justify-start group-data-[collapsible=icon]:px-2">
              <span className="group-data-[collapsible=icon]:hidden">{t("actions.signOut")}</span>
            </Button>
          </form>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-h-svh bg-slate-50">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <SidebarTrigger />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">{session.organizationName}</p>
            <p className="truncate text-xs text-slate-500">{t("app.workspace")}</p>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
