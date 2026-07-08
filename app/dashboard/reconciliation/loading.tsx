export default function ReconciliationLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="h-6 w-64 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-slate-200" />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-4 border-b border-slate-100 p-4 md:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      </section>

      {Array.from({ length: 2 }).map((_, sectionIndex) => (
        <section key={sectionIndex} className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-4 w-36 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="divide-y divide-slate-100 p-4">
            {Array.from({ length: 6 }).map((_, rowIndex) => (
              <div key={rowIndex} className="grid gap-4 py-3 md:grid-cols-[120px_1fr_140px_100px_160px_120px]">
                {Array.from({ length: 6 }).map((__, cellIndex) => (
                  <div key={cellIndex} className="h-4 animate-pulse rounded bg-slate-100" />
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
