"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SourceType } from "@prisma/client";
import { AlertTriangle, CheckCircle2, Link2, Loader2, PencilLine, RotateCcw, Send, ShieldCheck, Unlink, XCircle } from "lucide-react";
import {
  manuallyMatchTransactionsAction,
  removeManualMatchAction,
  correctManualMatchAction,
  rejectManualMatchAction,
  submitReconciliationRunForReviewAction,
  approveReconciliationRunAction,
  reopenReconciliationRunAction,
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

type SelectionState = {
  bankTransactionId: string | null;
  ledgerTransactionId: string | null;
};

type ManualMatchContextValue = {
  selection: SelectionState;
  selectTransaction: (sourceType: SourceType, transactionId: string) => void;
};

const ManualMatchContext = createContext<ManualMatchContextValue | null>(null);

function useManualMatchContext() {
  const context = useContext(ManualMatchContext);
  if (!context) {
    throw new Error("ManualMatchContext is missing. Wrap this component in a ManualMatchProvider.");
  }
  return context;
}

type SubmitResult = { status: "idle" } | { status: "success"; message: string } | { status: "error"; message: string };

export function ManualMatchProvider({ children, locked = false }: { children: ReactNode; locked?: boolean }) {
  const router = useRouter();
  const [selection, setSelection] = useState<SelectionState>({ bankTransactionId: null, ledgerTransactionId: null });
  const [result, setResult] = useState<SubmitResult>({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  function selectTransaction(sourceType: SourceType, transactionId: string) {
    setResult({ status: "idle" });
    setSelection((previous) =>
      sourceType === SourceType.BANK
        ? { ...previous, bankTransactionId: transactionId }
        : { ...previous, ledgerTransactionId: transactionId },
    );
  }

  const canMatch = Boolean(selection.bankTransactionId && selection.ledgerTransactionId) && !isPending && !locked;

  function handleMatch() {
    if (!selection.bankTransactionId || !selection.ledgerTransactionId) {
      return;
    }

    const bankTransactionId = selection.bankTransactionId;
    const ledgerTransactionId = selection.ledgerTransactionId;

    startTransition(async () => {
      const response = await manuallyMatchTransactionsAction({ bankTransactionId, ledgerTransactionId });

      if (response.ok) {
        setResult({ status: "success", message: response.message });
        setSelection({ bankTransactionId: null, ledgerTransactionId: null });
        router.refresh();
      } else {
        setResult({ status: "error", message: response.message });
      }
    });
  }

  return (
    <ManualMatchContext.Provider value={{ selection, selectTransaction }}>
      <div className="space-y-6">
        {children}

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-950">Manual match</h2>
              <p className="text-sm text-slate-500">
                {locked
                  ? "New matches are paused while the reconciliation run is awaiting approval."
                  : "Select one bank transaction and one ledger transaction, then confirm the match."}
              </p>
            </div>
            <Button type="button" onClick={handleMatch} disabled={!canMatch} className="gap-2">
              {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
              Match selected
            </Button>
          </div>

          {result.status !== "idle" ? (
            <p
              className={
                result.status === "success"
                  ? "mt-3 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                  : "mt-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              }
            >
              {result.status === "success" ? (
                <CheckCircle2 size={16} className="shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
              )}
              {result.message}
            </p>
          ) : null}
        </section>
      </div>
    </ManualMatchContext.Provider>
  );
}

export function RemoveMatchButton({ reconciliationMatchId, locked = false }: { reconciliationMatchId: string; locked?: boolean }) {
  const router = useRouter();
  const [result, setResult] = useState<SubmitResult>({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    startTransition(async () => {
      const response = await removeManualMatchAction({ reconciliationMatchId });

      if (response.ok) {
        router.refresh();
      } else {
        setResult({ status: "error", message: response.message });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" onClick={handleRemove} disabled={isPending || locked} className="gap-2">
        {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Unlink size={16} aria-hidden="true" />}
        Unmatch
      </Button>
      {result.status === "error" ? <p className="text-xs text-red-700">{result.message}</p> : null}
    </div>
  );
}

export function RejectMatchButton({ reconciliationMatchId, locked = false }: { reconciliationMatchId: string; locked?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSubmit = reason.trim().length > 0 && !isPending;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setReason("");
      setFormError(null);
    }
  }

  function handleConfirm() {
    if (!canSubmit) {
      return;
    }

    startTransition(async () => {
      const response = await rejectManualMatchAction({ reconciliationMatchId, reason });

      if (response.ok) {
        setOpen(false);
        setReason("");
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
        <Button type="button" variant="outline" disabled={locked} className="gap-2">
          <XCircle size={16} aria-hidden="true" />
          Reject match
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject this match?</AlertDialogTitle>
          <AlertDialogDescription>
            Both transactions return to Unmatched. The match is kept as history with the reason you provide below.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-600">Rejection reason</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Explain why this match is being rejected"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400"
          />
        </label>

        {formError ? <p className="text-xs text-red-700">{formError}</p> : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button type="button" onClick={handleConfirm} disabled={!canSubmit} className="gap-2">
            {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />}
            Reject match
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type CorrectionCandidate = { id: string; label: string };

export function CorrectMatchButton({
  reconciliationMatchId,
  locked = false,
  currentBankLabel,
  currentLedgerLabel,
  bankCandidates,
  ledgerCandidates,
}: {
  reconciliationMatchId: string;
  locked?: boolean;
  currentBankLabel: string;
  currentLedgerLabel: string;
  bankCandidates: CorrectionCandidate[];
  ledgerCandidates: CorrectionCandidate[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"" | "bank" | "ledger">("");
  const [replacementTransactionId, setReplacementTransactionId] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const candidates = side === "bank" ? bankCandidates : side === "ledger" ? ledgerCandidates : [];
  const canSubmit = side !== "" && replacementTransactionId !== "" && reason.trim().length > 0 && !isPending;

  function resetForm() {
    setSide("");
    setReplacementTransactionId("");
    setReason("");
    setFormError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  }

  function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    startTransition(async () => {
      const response = await correctManualMatchAction({
        reconciliationMatchId,
        replacementBankTransactionId: side === "bank" ? replacementTransactionId : undefined,
        replacementLedgerTransactionId: side === "ledger" ? replacementTransactionId : undefined,
        reason,
      });

      if (response.ok) {
        setOpen(false);
        resetForm();
        router.refresh();
      } else {
        setFormError(response.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={locked} className="gap-2">
          <PencilLine size={16} aria-hidden="true" />
          Correct match
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct match</DialogTitle>
          <DialogDescription>
            Replace one side of this match with a different transaction. The replaced transaction returns to Unmatched and
            this match is kept as history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Side to replace</span>
            <select
              value={side}
              onChange={(event) => {
                setSide(event.target.value as "" | "bank" | "ledger");
                setReplacementTransactionId("");
              }}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950"
            >
              <option value="">Select a side</option>
              <option value="bank">Bank transaction ({currentBankLabel})</option>
              <option value="ledger">Ledger transaction ({currentLedgerLabel})</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Replacement transaction</span>
            <select
              value={replacementTransactionId}
              onChange={(event) => setReplacementTransactionId(event.target.value)}
              disabled={side === ""}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 disabled:opacity-50"
            >
              <option value="">{side === "" ? "Select a side first" : "Select a transaction"}</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Correction reason</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Explain why this match is being corrected"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400"
            />
          </label>

          {formError ? <p className="text-xs text-red-700">{formError}</p> : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
            {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <PencilLine size={16} aria-hidden="true" />}
            Save correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SubmitRunButton({ reconciliationRunId, disabled = false }: { reconciliationRunId: string; disabled?: boolean }) {
  const router = useRouter();
  const [result, setResult] = useState<SubmitResult>({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const response = await submitReconciliationRunForReviewAction({ reconciliationRunId });

      if (response.ok) {
        router.refresh();
      } else {
        setResult({ status: "error", message: response.message });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" onClick={handleSubmit} disabled={isPending || disabled} className="gap-2">
        {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
        Submit for review
      </Button>
      {result.status === "error" ? <p className="text-xs text-red-700">{result.message}</p> : null}
    </div>
  );
}

export function ApproveRunButton({ reconciliationRunId }: { reconciliationRunId: string }) {
  const router = useRouter();
  const [result, setResult] = useState<SubmitResult>({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      const response = await approveReconciliationRunAction({ reconciliationRunId });

      if (response.ok) {
        router.refresh();
      } else {
        setResult({ status: "error", message: response.message });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" onClick={handleApprove} disabled={isPending} className="gap-2">
        {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}
        Approve run
      </Button>
      {result.status === "error" ? <p className="text-xs text-red-700">{result.message}</p> : null}
    </div>
  );
}

export function ReopenRunButton({ reconciliationRunId }: { reconciliationRunId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSubmit = reason.trim().length > 0 && !isPending;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setReason("");
      setFormError(null);
    }
  }

  function handleConfirm() {
    if (!canSubmit) {
      return;
    }

    startTransition(async () => {
      const response = await reopenReconciliationRunAction({ reconciliationRunId, reason });

      if (response.ok) {
        setOpen(false);
        setReason("");
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
          <RotateCcw size={16} aria-hidden="true" />
          Reopen run
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reopen this reconciliation run?</AlertDialogTitle>
          <AlertDialogDescription>
            This reverses the run&apos;s approval and returns it to Reopened so matches can be corrected. This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-600">Reason</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Explain why this run is being reopened"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400"
          />
        </label>

        {formError ? <p className="text-xs text-red-700">{formError}</p> : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button type="button" onClick={handleConfirm} disabled={!canSubmit} className="gap-2">
            {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}
            Reopen run
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SelectionRadio({ sourceType, transactionId, label }: { sourceType: SourceType; transactionId: string; label: string }) {
  const { selection, selectTransaction } = useManualMatchContext();
  const selectedId = sourceType === SourceType.BANK ? selection.bankTransactionId : selection.ledgerTransactionId;
  const isSelected = selectedId === transactionId;

  return (
    <input
      type="radio"
      name={sourceType === SourceType.BANK ? "bank-transaction-selection" : "ledger-transaction-selection"}
      checked={isSelected}
      onChange={() => selectTransaction(sourceType, transactionId)}
      aria-label={label}
      className="size-4 accent-blue-600"
    />
  );
}
