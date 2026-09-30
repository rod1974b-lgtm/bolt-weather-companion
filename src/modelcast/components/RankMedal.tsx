// src/modelcast/components/RankMedal.tsx
import { Medal } from 'lucide-react';

interface RankMedalProps {
  rank: number;
  className?: string;
}

const BADGES: Record<number, { bg: string; border: string; text: string }> = {
  1: {
    bg: 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600',
    border: 'border-amber-200 shadow-md shadow-amber-500/20',
    text: 'text-amber-950',
  },
  2: {
    bg: 'bg-gradient-to-b from-slate-100 via-slate-200 to-slate-400',
    border: 'border-white shadow-md shadow-slate-300/20',
    text: 'text-slate-900',
  },
  3: {
    bg: 'bg-gradient-to-b from-amber-600 via-amber-700 to-amber-900',
    border: 'border-amber-400/50 shadow-md shadow-amber-900/30',
    text: 'text-amber-100',
  },
};

export function RankMedal({ rank }: RankMedalProps) {
  const badge = BADGES[rank];
  if (!badge) return null;

  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center gap-0.5 rounded-full border text-xs font-black ${badge.bg} ${badge.border} ${badge.text}`}
    >
      <Medal size={13} className="shrink-0" />
      <span>{rank}</span>
    </div>
  );
}
