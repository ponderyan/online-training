export default function Loading() {
  return (
    <div className="p-8 space-y-6 animate-pulse"><div className="h-8 w-64 bg-gray-200 rounded" /><div className="h-40 bg-gray-100 rounded-xl" /><div className="grid grid-cols-2 gap-4">{[1,2].map(i => (<div key={i} className="h-24 bg-gray-100 rounded-xl" />))}</div></div>
  );
}
