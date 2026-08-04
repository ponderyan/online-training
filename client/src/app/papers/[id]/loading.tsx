export default function Loading() {
  return (
    <div className="p-8 space-y-6 animate-pulse"><div className="h-8 w-64 bg-[var(--paper-dark)] rounded" /><div className="h-40 bg-[var(--paper-alt)] rounded-xl" /><div className="grid grid-cols-2 gap-4">{[1,2].map(i => (<div key={i} className="h-24 bg-[var(--paper-alt)] rounded-xl" />))}</div></div>
  );
}
