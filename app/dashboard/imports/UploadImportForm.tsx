"use client";

import { useActionState } from "react";
import { Database, Landmark, Loader2, Upload } from "lucide-react";
import { uploadImportAction, type UploadImportState } from "./actions";
import { Button } from "@/src/app/components/ui/button";

const initialState: UploadImportState = {
  status: "idle",
  message: "",
};

export function UploadImportForm() {
  const [state, formAction, isPending] = useActionState(uploadImportAction, initialState);

  return (
    <form action={formAction} className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-base font-bold text-slate-950">Upload CSV</h2>
        <p className="mt-1 text-sm text-slate-500">The file is validated and processed immediately after upload.</p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-800">Source type</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 p-3 text-sm font-medium text-slate-800 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
            <input type="radio" name="sourceType" value="BANK" defaultChecked className="size-4 accent-blue-600" />
            <Landmark size={18} className="text-blue-600" aria-hidden="true" />
            Bank CSV
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 p-3 text-sm font-medium text-slate-800 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
            <input type="radio" name="sourceType" value="LEDGER" className="size-4 accent-blue-600" />
            <Database size={18} className="text-blue-600" aria-hidden="true" />
            Ledger CSV
          </label>
        </div>
      </fieldset>

      <div className="space-y-2">
        <label htmlFor="file" className="text-sm font-semibold text-slate-800">
          CSV file
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
        />
      </div>

      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          }
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="gap-2">
        {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
        Record upload
      </Button>
    </form>
  );
}