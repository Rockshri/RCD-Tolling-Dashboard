import { useEffect, useRef, useState } from 'react';

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function useAnimatedNumber(target: number, durationMs = 650): number {
  const [value, setValue] = useState(target);
  const start = useRef(target);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion()) { setValue(target); return; }
    start.current = value;
    const from = value;
    const to = target;
    if (from === to) return;
    const t0 = performance.now();

    function step(now: number) {
      const t = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (to - from) * eased);
      if (t < 1) frame.current = requestAnimationFrame(step);
    }
    frame.current = requestAnimationFrame(step);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };

  }, [target]);

  return value;
}
