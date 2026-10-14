/**
 * Pure edits to the cached copy of a review, used for optimistic updates. No React, no cache — just
 * "given this list, return that list" — so they can be tested on their own.
 */

/** The `likes` list after `myId` likes or unlikes. `wasLiked` is the state *before* the click. */
export function toggledLikes(likes: string[] | undefined, myId: string, wasLiked: boolean): string[] {
  const current = likes ?? [];
  if (wasLiked) return current.filter(id => id !== myId);
  return current.includes(myId) ? current : [...current, myId];
}

type WithLikes = { _id: string; likes?: string[] };

/** The comments list with one comment's likes toggled for `myId`; every other comment is the same object. */
export function withCommentLike<C extends WithLikes>(comments: C[], commentId: string, myId: string, wasLiked: boolean): C[] {
  return comments.map(c => (c._id === commentId ? { ...c, likes: toggledLikes(c.likes, myId, wasLiked) } : c));
}
