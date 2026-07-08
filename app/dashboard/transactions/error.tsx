"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/src/app/components/ui/button";

export default function TransactionsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <section className="rounded-lg border border-red-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-950">Transactions could not be loaded</h1>
            <p className="mt-1 text-sm text-slate-500">Refresh the review table or return later if the database is unavailable.</p>
            <Button type="button" onClick={reset} className="mt-4 gap-2">
              <RotateCcw size={16} aria-hidden="true" />
              Retry
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
