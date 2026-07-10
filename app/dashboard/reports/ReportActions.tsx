"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, Download, Loader2 } from "lucide-react";
import { generateReportExportAction } from "./actions";
import { Button } from "@/src/app/components/ui/button";

type SubmitResult = { status: "idle" } | { status: "success"; message: string } | { status: "error"; message: string };

export function GenerateReportButton({
  reportType,
  periodStart,
  periodEnd,
}: {
  reportType: string;
  periodStart: string;
  periodEnd: string;
}) {
  const router = useRouter();
  const [result, setResult] = useState<SubmitResult>({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      const response = await generateReportExportAction({ reportType, periodStart, periodEnd });

      if (response.ok) {
        setResult({ status: "success", message: response.message });
        router.refresh();
      } else {
        setResult({ status: "error", message: response.message });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" onClick={handleGenerate} disabled={isPending} className="gap-2">
        {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
        Generate &amp; export CSV
      </Button>
      {result.status !== "idle" ? (
        <p
          className={
            result.status === "success"
              ? "flex items-center gap-2 text-xs text-emerald-800"
              : "flex items-center gap-2 text-xs text-red-700"
          }
        >
          {result.status === "success" ? (
            <CheckCircle2 size={12} className="shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle size={12} className="shrink-0" aria-hidden="true" />
          )}
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
