import { prisma } from "@/lib/db/client";
import { requirePermission } from "@/lib/permissions/authorize";
import { fixedRoleLabels } from "@/lib/permissions/roles";
import { Badge } from "@/src/app/components/ui/badge";
import type { RoleName } from "@/types/permissions";
import {
  InviteMemberForm,
  ChangeMemberRoleSelect,
  DisableMemberButton,
  ReactivateMemberButton,
  CancelInvitationButton,
  ResendInvitationButton,
} from "./UserManagementForms";

const roleOptions: RoleName[] = ["ADMIN", "FINANCE_MANAGER", "ACCOUNTANT", "AUDITOR", "VIEWER"];

export default async function UsersPage() {
  const session = await requirePermission("users.manage");

  const [members, invitations] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId: session.organizationId, status: { in: ["ACTIVE", "DISABLED"] } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        status: true,
        user: { select: { id: true, fullName: true, email: true } },
        role: { select: { name: true } },
      },
    }),
    prisma.invitation.findMany({
      where: { organizationId: session.organizationId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        role: { select: { name: true } },
        invitedBy: { select: { fullName: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500">
            Manage who has access to {session.organizationName} and what they can do.
          </p>
        </div>
        <InviteMemberForm roleOptions={roleOptions} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-sm font-bold text-slate-950">
            {members.length.toLocaleString("en")} member{members.length === 1 ? "" : "s"}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.length > 0 ? (
                members.map((member) => {
                  const roleName = member.role.name as RoleName;
                  const isSelf = member.user.id === session.userId;

                  return (
                    <tr key={member.id} className="align-top">
                      <td className="px-4 py-3 font-medium text-slate-950">{member.user.fullName}</td>
                      <td className="px-4 py-3 text-slate-700">{member.user.email}</td>
                      <td className="px-4 py-3">
                        {member.status === "ACTIVE" ? (
                          <ChangeMemberRoleSelect
                            membershipId={member.id}
                            currentRoleName={roleName}
                            roleOptions={roleOptions}
                          />
                        ) : (
                          <span className="text-slate-500">{fixedRoleLabels[roleName]}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={member.status === "ACTIVE" ? "secondary" : "outline"}>
                          {member.status === "ACTIVE" ? "Active" : "Disabled"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {isSelf ? (
                          <span className="text-xs text-slate-400">You</span>
                        ) : member.status === "ACTIVE" ? (
                          <DisableMemberButton membershipId={member.id} />
                        ) : (
                          <ReactivateMemberButton membershipId={member.id} />
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                    No members yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-sm font-bold text-slate-950">
            {invitations.length.toLocaleString("en")} pending invitation{invitations.length === 1 ? "" : "s"}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Invited by</th>
                <th className="px-4 py-3 font-semibold">Expires</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invitations.length > 0 ? (
                invitations.map((invitation) => {
                  const isExpired = invitation.expiresAt <= new Date();

                  return (
                    <tr key={invitation.id} className="align-top">
                      <td className="px-4 py-3 font-medium text-slate-950">{invitation.email}</td>
                      <td className="px-4 py-3 text-slate-700">{fixedRoleLabels[invitation.role.name as RoleName]}</td>
                      <td className="px-4 py-3 text-slate-700">{invitation.invitedBy.fullName}</td>
                      <td className="px-4 py-3">
                        <Badge variant={isExpired ? "outline" : "secondary"}>
                          {isExpired ? "Expired" : invitation.expiresAt.toLocaleDateString("en-US")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-2">
                          <ResendInvitationButton invitationId={invitation.id} />
                          <CancelInvitationButton invitationId={invitation.id} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                    No pending invitations.
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
