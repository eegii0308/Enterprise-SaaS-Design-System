"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2, PencilLine, Plus, RotateCcw } from "lucide-react";
import {
  createBankAccountAction,
  updateBankAccountAction,
  archiveBankAccountAction,
  reactivateBankAccountAction,
} from "./actions";
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

type BankAccountFields = {
  name: string;
  bankName: string;
  maskedAccountNumber: string;
  currency: string;
};

const emptyFields: BankAccountFields = { name: "", bankName: "", maskedAccountNumber: "", currency: "" };

function BankAccountFieldset({
  fields,
  onChange,
}: {
  fields: BankAccountFields;
  onChange: (fields: BankAccountFields) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-slate-600">Account name</span>
        <input
          value={fields.name}
          onChange={(event) => onChange({ ...fields, name: event.target.value })}
          placeholder="e.g. Operating account"
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 placeholder:text-slate-400"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-slate-600">Bank name</span>
        <input
          value={fields.bankName}
          onChange={(event) => onChange({ ...fields, bankName: event.target.value })}
          placeholder="e.g. Khan Bank"
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 placeholder:text-slate-400"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-slate-600">Masked account number</span>
        <input
          value={fields.maskedAccountNumber}
          onChange={(event) => onChange({ ...fields, maskedAccountNumber: event.target.value })}
          placeholder="e.g. ****4821"
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 placeholder:text-slate-400"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-slate-600">Currency</span>
        <input
          value={fields.currency}
          onChange={(event) => onChange({ ...fields, currency: event.target.value.toUpperCase() })}
          maxLength={3}
          placeholder="e.g. MNT"
          className="h-10 w-24 rounded-md border border-slate-200 bg-white px-3 text-sm uppercase text-slate-950 placeholder:text-slate-400"
        />
      </label>
    </div>
  );
}

function isComplete(fields: BankAccountFields) {
  return (
    fields.name.trim().length > 0 &&
    fields.bankName.trim().length > 0 &&
    fields.maskedAccountNumber.trim().length > 0 &&
    fields.currency.trim().length === 3
  );
}

export function CreateBankAccountForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<BankAccountFields>(emptyFields);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSubmit = isComplete(fields) && !isPending;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setFields(emptyFields);
      setFormError(null);
    }
  }

  function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    startTransition(async () => {
      const response = await createBankAccountAction(fields);

      if (response.ok) {
        setOpen(false);
        setFields(emptyFields);
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
          <Plus size={16} aria-hidden="true" />
          Add bank account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a bank account</DialogTitle>
          <DialogDescription>
            New accounts are active immediately and become available for reconciliation run creation.
          </DialogDescription>
        </DialogHeader>

        <BankAccountFieldset fields={fields} onChange={setFields} />

        {formError ? <p className="text-xs text-red-700">{formError}</p> : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
            {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            Add bank account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditBankAccountButton({
  bankAccountId,
  initialFields,
}: {
  bankAccountId: string;
  initialFields: BankAccountFields;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<BankAccountFields>(initialFields);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSubmit = isComplete(fields) && !isPending;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setFields(initialFields);
      setFormError(null);
    }
  }

  function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    startTransition(async () => {
      const response = await updateBankAccountAction({ bankAccountId, ...fields });

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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <PencilLine size={16} aria-hidden="true" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit bank account</DialogTitle>
          <DialogDescription>Changes apply immediately and do not affect existing reconciliation runs.</DialogDescription>
        </DialogHeader>

        <BankAccountFieldset fields={fields} onChange={setFields} />

        {formError ? <p className="text-xs text-red-700">{formError}</p> : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
            {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <PencilLine size={16} aria-hidden="true" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ArchiveBankAccountButton({ bankAccountId }: { bankAccountId: string }) {
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
      const response = await archiveBankAccountAction({ bankAccountId });

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
          <Archive size={16} aria-hidden="true" />
          Archive
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive this bank account?</AlertDialogTitle>
          <AlertDialogDescription>
            The account is hidden from new reconciliation run creation, but existing runs and transactions that reference it
            are preserved. You can reactivate it later.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {formError ? <p className="text-xs text-red-700">{formError}</p> : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button type="button" onClick={handleConfirm} disabled={isPending} className="gap-2">
            {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
            Archive
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ReactivateBankAccountButton({ bankAccountId }: { bankAccountId: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleReactivate() {
    startTransition(async () => {
      const response = await reactivateBankAccountAction({ bankAccountId });

      if (response.ok) {
        router.refresh();
      } else {
        setFormError(response.message);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" onClick={handleReactivate} disabled={isPending} className="gap-2">
        {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}
        Reactivate
      </Button>
      {formError ? <p className="text-xs text-red-700">{formError}</p> : null}
    </div>
  );
}
