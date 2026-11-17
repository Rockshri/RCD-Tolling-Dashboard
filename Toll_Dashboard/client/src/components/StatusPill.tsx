export const TONE_COLORS: Record<string, string> = {
  done: 'bg-good',
  progress: 'bg-warn',
  pending: 'bg-bad',
  not_feasible: 'bg-darkgrey',
  neutral: 'bg-grey',
};

export function StatusPill({ label, tone }: { label: string | null | undefined; tone: string | null | undefined }) {
  const text = label ?? 'Not updated';
  const colour = tone ? TONE_COLORS[tone] ?? 'bg-grey' : 'bg-grey';
  return (
    <span
      className={`inline-block max-w-full ${colour} text-white font-semibold text-[11px] leading-tight uppercase tracking-wide px-2 py-1 rounded break-words`}
    >
      {text}
    </span>
  );
}
