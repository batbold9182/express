import { AVATAR_COLORS } from '@tunelog/shared';

type Props = { name: string; size?: number; src?: string; className?: string };

export function Avatar({ name, size = 36, src, className = '' }: Props) {
  const letter = name.trim()[0]?.toUpperCase() ?? '?';
  const pairs  = Object.values(AVATAR_COLORS);
  const pair   = pairs[letter.charCodeAt(0) % pairs.length];
  const color  = `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center shrink-0 font-bold ${className}`}
      style={{ width: size, height: size, background: color, fontSize: size * 0.42, color: '#fff' }}
    >
      {letter}
    </div>
  );
}
