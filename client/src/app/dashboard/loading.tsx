export default function Loading() {
  return (
    <div className="p-8 space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-[var(--paper-dark)] rounded" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-[var(--paper-alt)] rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-[var(--paper-alt)] rounded-xl" />
    </div>
  );
}
