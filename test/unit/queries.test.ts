import { qk } from "../../web/src/queries/keys";
import { shouldRetry } from "../../web/src/queries/retry";
import { nextOffset, flattenUnique, removeItem, mapItem } from "../../web/src/queries/pagination";
import { reviewedIds } from "../../web/src/queries/reviewedIds";
import { asArray } from "../../web/src/queries/asArray";
import { resolveChoice } from "../../web/src/queries/toggle";
import { toggledLikes, withCommentLike } from "../../web/src/queries/feedPatches";
import {
  afterReviewChange,
  afterReviewEditOrDelete,
  afterLikeOrComment,
  afterFollowChange,
  afterSpotifyDisconnect,
  toFilters,
  type Invalidation,
} from "../../web/src/queries/invalidation";

// The same rule TanStack Query uses to match a filter key against a cached query key.
const isPrefix = (prefix: readonly unknown[], key: readonly unknown[]) =>
  prefix.length <= key.length && prefix.every((p, i) => p === key[i]);
const covers = (list: Invalidation[], key: readonly unknown[]) => list.some(i => isPrefix(i.key, key));
const keysOf = (list: Invalidation[]) => list.map(i => JSON.stringify(i.key));

describe("query keys are hierarchical, so a prefix addresses a whole family", () => {
  test.each([
    ["feed tab under feed", qk.feedAll(), qk.feed("foryou")],
    ["leaderboard under leaderboard", qk.leaderboardAll(), qk.leaderboard("track", 100)],
    ["track reviews under track", qk.track("t1"), qk.trackReviews("t1")],
    ["album reviews under album", qk.album("a1"), qk.albumReviews("a1")],
    ["artist albums under artist", qk.artist("r1"), qk.artistAlbums("r1")],
    ["artist reviews under artist", qk.artist("r1"), qk.artistReviews("r1")],
    ["user counts under user", qk.user("u1"), qk.userCounts("u1")],
    ["user sample under user", qk.user("u1"), qk.userReviewsSample("u1")],
    ["user review list under user", qk.user("u1"), qk.userReviewsList("u1", "all", "")],
    ["me app under me", qk.meAll(), qk.meApp()],
    ["me spotify under me", qk.meAll(), qk.meSpotify()],
    ["me counts under me", qk.meAll(), qk.meCounts()],
    ["top artists under me", qk.meAll(), qk.topArtists("medium_term")],
    ["me review sample under me reviews", qk.meReviewsAll(), qk.meReviewsSample()],
    ["me review list under me reviews", qk.meReviewsAll(), qk.meReviewsList("all", "")],
    ["unread under notifications", qk.notifications(), qk.unreadCount()],
    ["suggested list under suggested", qk.suggestedUsers(), qk.suggestedUsersList(5)],
    ["a people search under all people searches", qk.userSearchAll(), qk.userSearch("ann")],
  ])("%s", (_name, parent, child) => {
    expect(isPrefix(parent, child)).toBe(true);
  });

  test("keys for different ids, types and searches do not collide", () => {
    expect(qk.track("a")).not.toEqual(qk.track("b"));
    expect(qk.userReviewsList("u", "track", "")).not.toEqual(qk.userReviewsList("u", "album", ""));
    expect(qk.userReviewsList("u", "all", "x")).not.toEqual(qk.userReviewsList("u", "all", "y"));
    expect(qk.search("All", "q")).not.toEqual(qk.search("Songs", "q"));
    expect(qk.feed("foryou")).not.toEqual(qk.feed("following"));
  });

  test("one id never addresses another entity's family", () => {
    // a track and an album can share an id string in tests; their roots must still differ
    expect(isPrefix(qk.track("x"), qk.album("x"))).toBe(false);
    expect(isPrefix(qk.user("x"), qk.track("x"))).toBe(false);
  });
});

describe("shouldRetry", () => {
  test("retries a network failure or timeout once, then gives up", () => {
    const network = Object.assign(new Error("network /x"), { code: "network" });
    const timeout = Object.assign(new Error("timeout /x"), { code: "timeout" });
    expect(shouldRetry(0, network)).toBe(true);
    expect(shouldRetry(1, network)).toBe(false);
    expect(shouldRetry(0, timeout)).toBe(true);
    expect(shouldRetry(1, timeout)).toBe(false);
  });

  test("retries a 5xx once", () => {
    expect(shouldRetry(0, { status: 500 })).toBe(true);
    expect(shouldRetry(0, { status: 502 })).toBe(true);
    expect(shouldRetry(1, { status: 502 })).toBe(false);
  });

  test.each([400, 401, 403, 404, 409, 429])("never retries a %i", status => {
    expect(shouldRetry(0, { status })).toBe(false);
  });

  test("never retries a cancelled request", () => {
    expect(shouldRetry(0, { name: "AbortError" })).toBe(false);
  });

  test("tolerates a non-error value", () => {
    expect(shouldRetry(0, null)).toBe(true);
    expect(shouldRetry(0, undefined)).toBe(true);
    expect(shouldRetry(0, "boom")).toBe(true);
  });
});

describe("nextOffset", () => {
  type Page = { items: number[]; hasMore?: boolean };
  const next = nextOffset<Page>(p => p.items.length);

  test("is undefined when the last page says there is no more", () => {
    expect(next({ items: [1, 2], hasMore: false }, [{ items: [1, 2], hasMore: false }])).toBeUndefined();
    expect(next({ items: [1, 2] }, [{ items: [1, 2] }])).toBeUndefined();
  });

  test("is the number of items already held, across all pages", () => {
    const p1: Page = { items: [1, 2, 3], hasMore: true };
    const p2: Page = { items: [4, 5], hasMore: true };
    expect(next(p1, [p1])).toBe(3);
    expect(next(p2, [p1, p2])).toBe(5);
  });

  test("counts whatever the caller says an item is (reviews, not items)", () => {
    const byReviews = nextOffset<{ reviews: string[]; hasMore: boolean }>(p => p.reviews.length);
    const p = { reviews: ["a", "b"], hasMore: true };
    expect(byReviews(p, [p])).toBe(2);
  });
});

describe("asArray", () => {
  test("passes an array through unchanged", () => {
    const list = [1, 2, 3];
    expect(asArray<number>(list)).toBe(list);
    expect(asArray<number>([])).toEqual([]);
  });

  test.each([
    ["null", null],
    ["undefined", undefined],
    ["an error object that came back with a 200", { error: "boom" }],
    ["a string", "nope"],
    ["a number", 7],
  ])("treats %s as an empty list, so a .map in render can never throw", (_name, value) => {
    expect(asArray(value)).toEqual([]);
    expect(() => asArray(value).map(x => x)).not.toThrow();
  });
});

describe("resolveChoice — a control must not freeze on a stale value", () => {
  test("with no click yet, shows what the data says", () => {
    expect(resolveChoice(false, null)).toBe(false);
    expect(resolveChoice(true, null)).toBe(true);
  });

  test("right after a click, the user's choice wins while the data is unchanged", () => {
    expect(resolveChoice(false, { from: false, to: true })).toBe(true);
    expect(resolveChoice(true, { from: true, to: false })).toBe(false);
  });

  test("once a refresh reports something different, the data wins again (the bug: it used to stay on the old value)", () => {
    expect(resolveChoice(true, { from: false, to: true })).toBe(true);
    expect(resolveChoice(false, { from: true, to: false })).toBe(false);
  });

  test("works for a whole list, compared by reference (an unchanged refresh keeps the same array)", () => {
    const before = ["a"], mine = ["a", "b"], refreshed = ["a", "b", "c"];
    expect(resolveChoice(before, { from: before, to: mine })).toBe(mine);            // data unchanged -> my edit shows
    expect(resolveChoice(refreshed, { from: before, to: mine })).toBe(refreshed);    // data changed -> the data wins
  });
});

describe("toggledLikes", () => {
  test("liking adds the user once; unliking removes them", () => {
    expect(toggledLikes(["a"], "me", false)).toEqual(["a", "me"]);
    expect(toggledLikes(["a", "me"], "me", true)).toEqual(["a"]);
  });
  test("never adds the same user twice, and tolerates a missing list", () => {
    expect(toggledLikes(["me"], "me", false)).toEqual(["me"]);
    expect(toggledLikes(undefined, "me", false)).toEqual(["me"]);
    expect(toggledLikes(undefined, "me", true)).toEqual([]);
  });
  test("does not mutate its input", () => {
    const likes = ["a", "me"];
    toggledLikes(likes, "me", true);
    expect(likes).toEqual(["a", "me"]);
  });
});

describe("withCommentLike", () => {
  const comments = [{ _id: "c1", likes: ["x"] }, { _id: "c2", likes: [] as string[] }];
  test("toggles only the named comment", () => {
    const out = withCommentLike(comments, "c1", "me", false);
    expect(out[0].likes).toEqual(["x", "me"]);
    expect(out[1]).toBe(comments[1]);                      // untouched comments are the same object
  });
  test("a comment with no likes field is handled", () => {
    expect(withCommentLike<{ _id: string; likes?: string[] }>([{ _id: "c3" }], "c3", "me", false)[0].likes).toEqual(["me"]);
  });
});

describe("feed page helpers", () => {
  type Page = { items: { _id: string; n?: number }[] };
  const pages: Page[] = [{ items: [{ _id: "a" }, { _id: "b" }] }, { items: [{ _id: "b" }, { _id: "c" }] }];

  test("flattenUnique joins the pages and keeps the first copy of a repeated item", () => {
    expect(flattenUnique(pages, p => p.items).map(i => i._id)).toEqual(["a", "b", "c"]);
    expect(flattenUnique(undefined, (p: Page) => p.items)).toEqual([]);
  });

  test("removeItem drops the item from every page, and returns the same data if it isn't there", () => {
    const data = { pages, pageParams: [0, 2] };
    const out = removeItem(data, "b");
    expect(out?.pages.map(p => p.items.map(i => i._id))).toEqual([["a"], ["c"]]);
    expect(removeItem(data, "zzz")).toBe(data);
    expect(removeItem(undefined, "a")).toBeUndefined();
  });

  test("mapItem patches one item in place and leaves the others as the same objects", () => {
    const data = { pages: [{ items: [{ _id: "a", n: 1 }, { _id: "b", n: 2 }] }], pageParams: [0] };
    const out = mapItem(data, "b", i => ({ ...i, n: 99 }));
    expect(out?.pages[0].items.map(i => i.n)).toEqual([1, 99]);
    expect(out?.pages[0].items[0]).toBe(data.pages[0].items[0]);
    expect(mapItem(data, "zzz", i => i)).toBe(data);
  });
});

describe("reviewedIds", () => {
  test("sorts the caller's reviews into track, album and artist sets", () => {
    const r = reviewedIds([
      { type: "track", spotifyTrackId: "t1", spotifyAlbumId: "a1", spotifyArtistId: "r1" },
      { type: "album", spotifyAlbumId: "a2" },
      { type: "artist", spotifyArtistId: "r2" },
    ]);
    expect([...r.tracks]).toEqual(["t1"]);
    expect([...r.albums]).toEqual(["a2"]);
    expect([...r.artists]).toEqual(["r2"]);
  });

  test("a track review's album and artist ids do NOT mark that album or artist as reviewed", () => {
    const r = reviewedIds([{ type: "track", spotifyTrackId: "t1", spotifyAlbumId: "a1", spotifyArtistId: "r1" }]);
    expect(r.albums.has("a1")).toBe(false);
    expect(r.artists.has("r1")).toBe(false);
  });

  test("an older track review with no type still counts under its track id", () => {
    expect(reviewedIds([{ spotifyTrackId: "t9" }]).tracks.has("t9")).toBe(true);
  });

  test("ignores an album or artist review that is missing its id, and an empty list", () => {
    const r = reviewedIds([{ type: "album" }, { type: "artist" }]);
    expect(r.tracks.size + r.albums.size + r.artists.size).toBe(0);
    expect(reviewedIds([]).tracks.size).toBe(0);
  });
});

describe("invalidation map", () => {
  const trackReview = { spotifyTrackId: "t1", spotifyAlbumId: "a1", spotifyArtistId: "r1" };

  test("posting a track review refreshes the track, album and artist pages and everything that lists reviews", () => {
    const list = afterReviewChange(trackReview);
    expect(covers(list, qk.myReviews())).toBe(true);             // "Already reviewed" badges
    expect(covers(list, qk.feed("foryou"))).toBe(true);
    expect(covers(list, qk.feed("following"))).toBe(true);
    expect(covers(list, qk.leaderboard("track", 100))).toBe(true);
    expect(covers(list, qk.trackReviews("t1"))).toBe(true);
    expect(covers(list, qk.albumReviews("a1"))).toBe(true);      // album page aggregates track reviews
    expect(covers(list, qk.artistReviews("r1"))).toBe(true);     // so does the artist page
    expect(covers(list, qk.meCounts())).toBe(true);
    expect(covers(list, qk.meReviewsSample())).toBe(true);
    expect(covers(list, qk.meReviewsList("all", ""))).toBe(true);
  });

  test("it does not refresh unrelated entities", () => {
    const list = afterReviewChange(trackReview);
    expect(covers(list, qk.track("other"))).toBe(false);
    expect(covers(list, qk.album("other"))).toBe(false);
    expect(covers(list, qk.artist("other"))).toBe(false);
    expect(covers(list, qk.notifications())).toBe(false);
  });

  test("an album review touches only the album", () => {
    const list = afterReviewChange({ spotifyAlbumId: "a1" });
    expect(covers(list, qk.album("a1"))).toBe(true);
    expect(covers(list, qk.track("t1"))).toBe(false);
    expect(covers(list, qk.artist("r1"))).toBe(false);
  });

  test("an artist review touches only the artist", () => {
    const list = afterReviewChange({ spotifyArtistId: "r1" });
    expect(covers(list, qk.artist("r1"))).toBe(true);
    expect(covers(list, qk.album("a1"))).toBe(false);
  });

  test("the author's profile is refreshed only when the author is known", () => {
    expect(covers(afterReviewChange(trackReview), qk.userCounts("u1"))).toBe(false);
    expect(covers(afterReviewChange({ ...trackReview, authorId: "u1" }), qk.userCounts("u1"))).toBe(true);
  });

  test("a review change refetches what is on screen (nothing is merely marked stale)", () => {
    expect(afterReviewChange(trackReview).every(i => !i.stale)).toBe(true);
  });

  test("editing or deleting a review marks the feed stale (it was patched in place) but still refreshes everything else", () => {
    const list = afterReviewEditOrDelete(trackReview);
    const feed = list.find(i => JSON.stringify(i.key) === JSON.stringify(qk.feedAll()));
    expect(feed?.stale).toBe(true);
    expect(list.filter(i => i !== feed).every(i => !i.stale)).toBe(true);
    expect(covers(list, qk.myReviews())).toBe(true);
    expect(covers(list, qk.leaderboard("track", 100))).toBe(true);
    expect(covers(list, qk.trackReviews("t1"))).toBe(true);
  });

  test("a like or comment only marks the feed stale, so the screen never jumps", () => {
    const list = afterLikeOrComment();
    expect(keysOf(list)).toEqual([JSON.stringify(qk.feedAll())]);
    expect(list.every(i => i.stale === true)).toBe(true);
  });

  test("a follow refreshes the profile, suggestions and your own counts; the Following feed is only marked stale", () => {
    const list = afterFollowChange("u1");
    expect(covers(list, qk.userCounts("u1"))).toBe(true);
    expect(covers(list, qk.suggestedUsers())).toBe(true);
    expect(covers(list, qk.meApp())).toBe(true);
    const feed = list.find(i => JSON.stringify(i.key) === JSON.stringify(qk.feed("following")));
    expect(feed?.stale).toBe(true);
    expect(covers(list, qk.feed("foryou"))).toBe(false);          // For You is unaffected by who you follow
    expect(covers(list, qk.user("someone-else"))).toBe(false);
  });

  test("a follow also marks cached people-search results stale (they hold isFollowing), without redrawing them", () => {
    const list = afterFollowChange("u1");
    expect(covers(list, qk.userSearch("ann"))).toBe(true);
    expect(covers(list, qk.suggestedUsersList(5))).toBe(true);    // the suggestions list itself, not just the prefix
    const search = list.find(i => JSON.stringify(i.key) === JSON.stringify(qk.userSearchAll()));
    expect(search?.stale).toBe(true);
  });

  test("disconnecting Spotify refreshes everything under me, plus now-playing", () => {
    const list = afterSpotifyDisconnect();
    expect(covers(list, qk.meApp())).toBe(true);
    expect(covers(list, qk.meSpotify())).toBe(true);
    expect(covers(list, qk.topArtists("short_term"))).toBe(true);
    expect(covers(list, qk.nowPlaying())).toBe(true);
    expect(covers(list, qk.feed("foryou"))).toBe(false);
  });

  test("toFilters: stale becomes refetchType 'none', everything else 'active'", () => {
    const filters = toFilters([{ key: qk.feedAll(), stale: true }, { key: qk.myReviews() }]);
    expect(filters).toEqual([
      { queryKey: ["feed"], refetchType: "none" },
      { queryKey: ["reviews", "mine"], refetchType: "active" },
    ]);
  });
});
