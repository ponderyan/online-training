export default function Loading() {
  return (
    <div className="p-8 space-y-6 animate-pulse"><div className="h-8 w-48 bg-[var(--paper-dark)] rounded" /><div className="space-y-3">{[1,2,3,4,5].map(i => (<div key={i} className="h-14 bg-[var(--paper-alt)] rounded-xl" />))}</div></div>
  );
}
