"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, RotateCcw, ShieldOff, UserPlus, X } from "lucide-react";
import {
  inviteMemberAction,
  cancelInvitationAction,
  resendInvitationAction,
  changeMemberRoleAction,
  disableMemberAction,
  reactivateMemberAction,
} from "./actions";
import { fixedRoleLabels } from "@/lib/permissions/roles";
import type { RoleName } from "@/types/permissions";
import { Button } from "@/src/app/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/app/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/src/app/components/ui/alert-dialog";

function RoleSelectInput({
  value,
  onChange,
  roleOptions,
}: {
  value: RoleName;
  onChange: (value: RoleName) => void;
  roleOptions: RoleName[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as RoleName)}
      className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-950"
    >
      {roleOptions.map((roleName) => (
        <option key={roleName} value={roleName}>
          {fixedRoleLabels[roleName]}
        </option>
      ))}
    </select>
  );
}

export function InviteMemberForm({ roleOptions }: { roleOptions: RoleName[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [roleName, setRoleName] = useState<RoleName>(roleOptions[roleOptions.length - 1] ?? "VIEWER");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSubmit = email.trim().length > 3 && email.includes("@") && !isPending;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setEmail("");
      setFormError(null);
    }
  }

  function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    startTransition(async () => {
      const response = await inviteMemberAction({ email: email.trim(), roleName });

      if (response.ok) {
        setOpen(false);
        setEmail("");
        setFormError(null);
        router.refresh();
      } else {
        setFormError(response.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" className="gap-2">
          <UserPlus size={16} aria-hidden="true" />
          Invite user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>
            An email invitation is sent with a link to create their account. The link expires after 7 days.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              type="email"
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 placeholder:text-slate-400"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Role</span>
            <RoleSelectInput value={roleName} onChange={setRoleName} roleOptions={roleOptions} />
          </label>
        </div>

        {formError ? <p className="text-xs text-red-700">{formError}</p> : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
            {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Mail size={16} aria-hidden="true" />}
            Send invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ChangeMemberRoleSelect({
  membershipId,
  currentRoleName,
  roleOptions,
}: {
  membershipId: string;
  currentRoleName: RoleName;
  roleOptions: RoleName[];
}) {
  const router = useRouter();
  const [roleName, setRoleName] = useState<RoleName>(currentRoleName);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(nextRoleName: RoleName) {
    if (nextRoleName === roleName || isPending) {
      return;
    }

    const previousRoleName = roleName;
    setRoleName(nextRoleName);
    setFormError(null);

    startTransition(async () => {
      const response = await changeMemberRoleAction({ membershipId, roleName: nextRoleName });

      if (response.ok) {
        router.refresh();
      } else {
        setRoleName(previousRoleName);
        setFormError(response.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <RoleSelectInput value={roleName} onChange={handleChange} roleOptions={roleOptions} />
      {formError ? <p className="text-xs text-red-700">{formError}</p> : null}
    </div>
  );
}

export function DisableMemberButton({ membershipId }: { membershipId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setFormError(null);
    }
  }

  function handleConfirm() {
    startTransition(async () => {
      const response = await disableMemberAction({ membershipId });

      if (response.ok) {
        setOpen(false);
        setFormError(null);
        router.refresh();
      } else {
        setFormError(response.message);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <ShieldOff size={16} aria-hidden="true" />
          Disable
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disable this member?</AlertDialogTitle>
          <AlertDialogDescription>
            They immediately lose access to this organization. You can reactivate them later without re-sending an
            invitation.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {formError ? <p className="text-xs text-red-700">{formError}</p> : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button type="button" onClick={handleConfirm} disabled={isPending} className="gap-2">
            {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <ShieldOff size={16} aria-hidden="true" />}
            Disable
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ReactivateMemberButton({ membershipId }: { membershipId: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleReactivate() {
    startTransition(async () => {
      const response = await reactivateMemberAction({ membershipId });

      if (response.ok) {
        router.refresh();
      } else {
        setFormError(response.message);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" onClick={handleReactivate} disabled={isPending} className="gap-2">
        {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}
        Reactivate
      </Button>
      {formError ? <p className="text-xs text-red-700">{formError}</p> : null}
    </div>
  );
}

export function CancelInvitationButton({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setFormError(null);
    }
  }

  function handleConfirm() {
    startTransition(async () => {
      const response = await cancelInvitationAction({ invitationId });

      if (response.ok) {
        setOpen(false);
        setFormError(null);
        router.refresh();
      } else {
        setFormError(response.message);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <X size={16} aria-hidden="true" />
          Cancel
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this invitation?</AlertDialogTitle>
          <AlertDialogDescription>The invitation link stops working immediately.</AlertDialogDescription>
        </AlertDialogHeader>

        {formError ? <p className="text-xs text-red-700">{formError}</p> : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Keep invitation</AlertDialogCancel>
          <Button type="button" onClick={handleConfirm} disabled={isPending} className="gap-2">
            {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
            Cancel invitation
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ResendInvitationButton({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleResend() {
    startTransition(async () => {
      const response = await resendInvitationAction({ invitationId });

      if (response.ok) {
        router.refresh();
      } else {
        setFormError(response.message);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" onClick={handleResend} disabled={isPending} className="gap-2">
        {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Mail size={16} aria-hidden="true" />}
        Resend
      </Button>
      {formError ? <p className="text-xs text-red-700">{formError}</p> : null}
    </div>
  );
}
