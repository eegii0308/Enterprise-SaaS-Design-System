export default function TransactionsLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-slate-200" />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-4 border-b border-slate-100 p-4 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
        <div className="divide-y divide-slate-100 p-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="grid gap-4 py-3 md:grid-cols-[120px_1fr_120px_100px]">
              <div className="h-4 animate-pulse rounded bg-slate-100" />
              <div className="h-4 animate-pulse rounded bg-slate-100" />
              <div className="h-4 animate-pulse rounded bg-slate-100" />
              <div className="h-4 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
