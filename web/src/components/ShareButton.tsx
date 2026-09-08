import { useState } from 'react';
import { shareReview } from '../lib/share';
import type { ShareReviewInput } from '../lib/share';
import { ShareIcon } from './icons';

type Props = { review: ShareReviewInput; iconOnly?: boolean; className?: string };

export function ShareButton({ review, iconOnly = false, className }: Props) {
  const [state, setState] = useState<'idle' | 'busy' | 'copied'>('idle');

  async function onClick(e: React.MouseEvent) {
    e.stopPropagation();       // don't trigger the surrounding card's navigation
    e.preventDefault();
    if (state === 'busy') return;
    setState('busy');
    try {
      const r = await shareReview(review);
      if (r === 'copied') { setState('copied'); setTimeout(() => setState('idle'), 1800); }
      else setState('idle');
    } catch { setState('idle'); }
  }

  const label = state === 'copied' ? 'Copied' : 'Share';

  return (
    <button
      onClick={onClick}
      title="Share"
      aria-label="Share review"
      className={className ?? 'flex items-center gap-1.5 text-[12px] font-semibold text-fg3 hover:text-fg transition-colors cursor-pointer disabled:opacity-50'}
      disabled={state === 'busy'}
    >
      <ShareIcon size={14} />
      {!iconOnly && label}
    </button>
  );
}
