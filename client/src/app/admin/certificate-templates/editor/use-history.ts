import { useState, useCallback, useRef } from 'react';

// ── Undo/Redo Hook ──
export function useHistory<T>(initial: T) {
  const [state, setState] = useState<T>(initial);
  const history = useRef<T[]>([initial]);
  const idx = useRef(0);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setState(prev => {
      const val = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      history.current = history.current.slice(0, idx.current + 1);
      history.current.push(val);
      if (history.current.length > 50) history.current.shift();
      idx.current = history.current.length - 1;
      return val;
    });
  }, []);

  const undo = useCallback(() => {
    if (idx.current > 0) { idx.current--; setState(history.current[idx.current]); }
  }, []);

  const redo = useCallback(() => {
    if (idx.current < history.current.length - 1) { idx.current++; setState(history.current[idx.current]); }
  }, []);

  const canUndo = idx.current > 0;
  const canRedo = idx.current < history.current.length - 1;

  return { state, set, undo, redo, canUndo, canRedo };
}
