import { scoreColor } from '@tunelog/shared';
import { formatScore, hasScore, NO_SCORE_COLOR } from '../lib/score';

type Props = { value: number | null | undefined; size?: 'sm' | 'md' | 'lg' };

/** A score in its colour; "—" for a review without one. */
export function Score({ value, size = 'md' }: Props) {
  const color = hasScore(value) ? scoreColor(value) : NO_SCORE_COLOR;
  const fs = size === 'sm' ? 13 : size === 'lg' ? 26 : 18;
  return (
    <span
      className="font-bold tabular-nums"
      style={{ color, fontSize: fs }}
    >
      {formatScore(value)}
    </span>
  );
}
