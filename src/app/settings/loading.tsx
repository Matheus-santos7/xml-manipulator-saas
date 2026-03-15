export default function SettingsLoading() {
  return (
    <div className="container mx-auto py-8 h-[calc(100vh-4rem)] animate-in fade-in duration-200">
      <div className="mb-4 h-10 w-48 rounded-md bg-muted" />
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full">
        <div className="md:col-span-4">
          <div className="rounded-lg border bg-card p-6 h-full">
            <div className="h-6 w-32 rounded bg-muted mb-2" />
            <div className="h-4 w-48 rounded bg-muted/70 mb-4" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded-lg bg-muted/50 animate-pulse"
                  style={{ animationDelay: `${i * 50}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="md:col-span-8">
          <div className="rounded-lg border bg-card p-6 h-full">
            <div className="h-6 w-40 rounded bg-muted mb-2" />
            <div className="h-4 w-56 rounded bg-muted/70 mb-6" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-lg bg-muted/50 animate-pulse"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
