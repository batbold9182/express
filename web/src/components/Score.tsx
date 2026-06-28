import { scoreColor } from '@tunelog/shared';

type Props = { value: number; size?: 'sm' | 'md' | 'lg' };

export function Score({ value, size = 'md' }: Props) {
  const color = scoreColor(value);
  const fs = size === 'sm' ? 13 : size === 'lg' ? 26 : 18;
  return (
    <span
      className="font-bold tabular-nums"
      style={{ color, fontSize: fs }}
    >
      {value.toFixed(1)}
    </span>
  );
}
