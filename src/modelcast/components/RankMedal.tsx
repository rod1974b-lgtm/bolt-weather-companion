import goldMedal from '@/assets/model-rank-medals/rank-1.png';
import silverMedal from '@/assets/model-rank-medals/rank-2.png';
import bronzeMedal from '@/assets/model-rank-medals/rank-3.png';

const MEDALS = [goldMedal, silverMedal, bronzeMedal] as const;

interface RankMedalProps {
  rank: number;
  className?: string;
}

export function RankMedal({ rank, className = 'h-11 w-11' }: RankMedalProps) {
  const medal = MEDALS[rank - 1];
  if (!medal) return null;

  return (
    <img
      src={medal}
      alt={`${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : 'rd'} place medal`}
      className={`${className} shrink-0 object-contain drop-shadow-md`}
      loading="lazy"
    />
  );
}
