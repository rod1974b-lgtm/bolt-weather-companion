// src/modelcast/components/RankMedal.tsx
interface RankMedalProps {
  rank: number;
  className?: string;
}

const MEDAL_STYLES = {
  1: {
    bg: 'bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600',
    border: 'border-amber-200/90 shadow-lg shadow-amber-500/30',
    text: 'text-amber-950',
    icon: '🥇',
  },
  2: {
    bg: 'bg-gradient-to-br from-slate-100 via-slate-200 to-slate-400',
    border: 'border-white/80 shadow-lg shadow-slate-300/20',
    text: 'text-slate-900',
    icon: '🥈',
  },
  3: {
    bg: 'bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900',
    border: 'border-amber-400/60 shadow-lg shadow-amber-900/30',
    text: 'text-amber-100',
    icon: '🥉',
  },
} as const;

export function RankMedal({ rank, className = 'h-8 w-8' }: RankMedalProps) {
  const style = MEDAL_STYLES[rank as 1 | 2 | 3];
  if (!style) return null;

  return (
    <div
      className={`flex ${className} shrink-0 items-center justify-center rounded-full border text-base leading-none select-none ${style.bg} ${style.border} ${style.text}`}
      title={`Rank #${rank}`}
    >
      <span>{style.icon}</span>
    </div>
  );
}
