import { Building2 } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requirePermission } from "@/lib/permissions/authorize";
import { Badge } from "@/src/app/components/ui/badge";
import { CreateBankAccountForm, EditBankAccountButton, ArchiveBankAccountButton, ReactivateBankAccountButton } from "./BankAccountForms";

export default async function BankAccountsPage() {
  const session = await requirePermission("bank_accounts.manage");

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      bankName: true,
      maskedAccountNumber: true,
      currency: true,
      status: true,
      _count: { select: { reconciliationRuns: true } },
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bank accounts</h1>
          <p className="text-sm text-slate-500">
            Manage the bank accounts {session.organizationName} reconciles against. Only active accounts can be selected
            when creating a reconciliation run.
          </p>
        </div>
        <CreateBankAccountForm />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-sm font-bold text-slate-950">
            {bankAccounts.length.toLocaleString("en")} bank account{bankAccounts.length === 1 ? "" : "s"}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Account</th>
                <th className="px-4 py-3 font-semibold">Bank</th>
                <th className="px-4 py-3 font-semibold">Account number</th>
                <th className="px-4 py-3 font-semibold">Currency</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Reconciliation runs</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bankAccounts.length > 0 ? (
                bankAccounts.map((bankAccount) => (
                  <tr key={bankAccount.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-2 font-medium text-slate-950">
                        <Building2 size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                        {bankAccount.name}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{bankAccount.bankName}</td>
                    <td className="px-4 py-3 text-slate-700">{bankAccount.maskedAccountNumber}</td>
                    <td className="px-4 py-3 text-slate-700">{bankAccount.currency}</td>
                    <td className="px-4 py-3">
                      <Badge variant={bankAccount.status === "active" ? "secondary" : "outline"}>
                        {bankAccount.status === "active" ? "Active" : "Archived"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{bankAccount._count.reconciliationRuns.toLocaleString("en")}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-2">
                        <EditBankAccountButton
                          bankAccountId={bankAccount.id}
                          initialFields={{
                            name: bankAccount.name,
                            bankName: bankAccount.bankName,
                            maskedAccountNumber: bankAccount.maskedAccountNumber,
                            currency: bankAccount.currency,
                          }}
                        />
                        {bankAccount.status === "active" ? (
                          <ArchiveBankAccountButton bankAccountId={bankAccount.id} />
                        ) : (
                          <ReactivateBankAccountButton bankAccountId={bankAccount.id} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <p className="text-sm font-semibold text-slate-900">No bank accounts yet</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Add a bank account above before creating a reconciliation run.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
