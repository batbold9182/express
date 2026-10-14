import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { invalidate, queryClient } from '../queries/client';
import { patchReviewInFeeds } from '../queries/feed';
import { toggledLikes } from '../queries/feedPatches';
import { afterLikeOrComment } from '../queries/invalidation';
import { HeartIcon } from './icons';

type Props = { reviewId: string; likes: string[]; myId: string };

/**
 * `likes` comes from the cached feed, and a click edits that cached review in place — so there is no
 * copy of "liked" or the count in component state to go stale when the feed refreshes. A failed
 * request rolls the cache back and the global handler shows a toast.
 */
export function LikeButton({ reviewId, likes, myId }: Props) {
  const liked = likes.includes(myId);
  const count = likes.length;

  const mutation = useMutation({
    mutationFn: (wasLiked: boolean) =>
      wasLiked ? api.del(`/reviews/${reviewId}/like`) : api.post(`/reviews/${reviewId}/like`, {}),
    onMutate: (wasLiked: boolean) => ({
      rollback: patchReviewInFeeds(queryClient, reviewId, r => ({ ...r, likes: toggledLikes(r.likes, myId, wasLiked) })),
    }),
    onError: (_error, _wasLiked, context) => context?.rollback(),
    // Someone else may have liked it meanwhile: mark the feed out of date, refetch the next time it mounts.
    onSuccess: () => { void invalidate(afterLikeOrComment()); },
  });

  return (
    <button
      onClick={() => { if (!mutation.isPending) mutation.mutate(liked); }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors cursor-pointer"
      style={{
        borderColor: liked ? 'rgba(224,104,92,0.5)' : 'rgba(255,255,255,0.08)',
        background:  liked ? 'rgba(224,104,92,0.12)' : 'transparent',
        color:       liked ? '#E0685C' : '#978A74',
      }}
    >
      <HeartIcon size={14} filled={liked} />
      <span className="text-xs font-semibold">{count > 0 ? count : ''}</span>
    </button>
  );
}
