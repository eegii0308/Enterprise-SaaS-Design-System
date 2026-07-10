import Link from "next/link";
import { AuthFormShell } from "@/features/auth/components/AuthFormShell";
import { lookupInvitationByToken, type AcceptInvitationPrisma } from "@/lib/invitations/accept";
import { prisma } from "@/lib/db/client";
import { fixedRoleLabels } from "@/lib/permissions/roles";
import type { RoleName } from "@/types/permissions";
import { AcceptInvitationForm } from "./AcceptInvitationForm";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const invitation = await lookupInvitationByToken(token, prisma as unknown as AcceptInvitationPrisma);

  if (!invitation.valid) {
    return (
      <AuthFormShell title="Invitation not available" subtitle="This invitation link is invalid or has expired.">
        <Link href="/login" className="text-sm text-blue-600 hover:underline">
          Back to sign in
        </Link>
      </AuthFormShell>
    );
  }

  return (
    <AuthFormShell
      title={`Join ${invitation.organizationName}`}
      subtitle={`You've been invited as ${fixedRoleLabels[invitation.roleName as RoleName]}.`}
    >
      <AcceptInvitationForm token={token} email={invitation.email} isReactivation={invitation.isReactivation} />
    </AuthFormShell>
  );
}
