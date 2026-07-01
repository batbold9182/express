import { useState } from 'react';
import { shareReview } from '../lib/share';
import type { ShareReviewInput } from '../lib/share';

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
      <ShareIcon />
      {!iconOnly && label}
    </button>
  );
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
