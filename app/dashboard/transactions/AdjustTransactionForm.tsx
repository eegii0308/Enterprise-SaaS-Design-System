"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PencilLine } from "lucide-react";
import { adjustTransactionAction } from "./actions";
import { Button } from "@/src/app/components/ui/button";

type FieldOption = {
  value: string;
  label: string;
  currentValue: string;
  inputType: "text" | "number" | "date";
};

export function AdjustTransactionForm({ transactionId, fields }: { transactionId: string; fields: FieldOption[] }) {
  const router = useRouter();
  const [fieldName, setFieldName] = useState(fields[0]?.value ?? "");
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedField = fields.find((field) => field.value === fieldName) ?? fields[0];
  const canSubmit = Boolean(fieldName) && newValue.trim().length > 0 && reason.trim().length > 0 && !isPending;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setFormError(null);
    setFormSuccess(null);

    startTransition(async () => {
      const response = await adjustTransactionAction({ transactionId, fieldName, newValue, reason });

      if (response.ok) {
        setFormSuccess(response.message);
        setNewValue("");
        setReason("");
        router.refresh();
      } else {
        setFormError(response.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-600">Field</span>
          <select
            value={fieldName}
            onChange={(event) => {
              setFieldName(event.target.value);
              setNewValue("");
            }}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950"
          >
            {fields.map((field) => (
              <option key={field.value} value={field.value}>
                {field.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-600">Current value</span>
          <p className="flex h-10 items-center rounded-md border border-slate-100 bg-slate-50 px-3 text-sm text-slate-700">
            {selectedField?.currentValue || "—"}
          </p>
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-slate-600">New value</span>
        <input
          type={selectedField?.inputType ?? "text"}
          step={selectedField?.inputType === "number" ? "0.01" : undefined}
          value={newValue}
          onChange={(event) => setNewValue(event.target.value)}
          placeholder="Enter the corrected value"
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 placeholder:text-slate-400"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-slate-600">Adjustment reason</span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          placeholder="Explain why this correction is being made"
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400"
        />
      </label>

      {formError ? <p className="text-xs text-red-700">{formError}</p> : null}
      {formSuccess ? <p className="text-xs text-emerald-700">{formSuccess}</p> : null}

      <Button type="submit" disabled={!canSubmit} className="gap-2">
        {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <PencilLine size={16} aria-hidden="true" />}
        Save correction
      </Button>
    </form>
  );
}
