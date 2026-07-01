import { postUrl, buildShareCaption } from '@tunelog/shared';
import type { ShareItem } from '@tunelog/shared';

export type ShareReviewInput = ShareItem & { _id: string };
export type ShareResult = 'shared' | 'copied' | 'cancelled';

type Nav = Navigator & { canShare?: (data?: unknown) => boolean };

/**
 * Share a review via the native OS share sheet: a story-format card image (from the
 * /api/og endpoint) + a caption + the express post link (/r/:id). Falls back to
 * downloading the image + copying the link on desktop / browsers without Web Share.
 *
 * NOTE: `navigator.share` needs a user gesture. We fetch the image first, then share;
 * modern mobile browsers tolerate the short async gap. If activation is lost the call
 * throws and we degrade to the copy/download path.
 */
export async function shareReview(review: ShareReviewInput): Promise<ShareResult> {
  const id = review._id;
  const url = postUrl(id, window.location.origin);
  const text = buildShareCaption(review);

  let file: File | null = null;
  try {
    const res = await fetch(`${window.location.origin}/api/og/${id}?format=story`);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.type.startsWith('image/')) file = new File([blob], 'express-review.png', { type: blob.type });
    }
  } catch { /* no image — share text + link only */ }

  const nav = navigator as Nav;
  try {
    if (file && nav.canShare?.({ files: [file] })) {
      await nav.share!({ files: [file], text, url });
      return 'shared';
    }
    if (nav.share) {
      await nav.share({ text, url });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return 'cancelled';
    /* fall through to the download/copy fallback */
  }

  if (file) {
    const objUrl = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  }
  try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
  return 'copied';
}
