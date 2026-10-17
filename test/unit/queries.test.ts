import { qk } from "../../web/src/queries/keys";
import { shouldRetry } from "../../web/src/queries/retry";
import { nextOffset, flattenUnique, removeItem, mapItem } from "../../web/src/queries/pagination";
import { reviewedIds } from "../../web/src/queries/reviewedIds";
import { asArray } from "../../web/src/queries/asArray";
import { buildReviewBody } from "../../web/src/queries/reviewBody";
import { toCounts, totalOf, NO_COUNTS } from "../../web/src/queries/counts";
import { playableTrack, type NowPlayingData } from "../../web/src/queries/nowPlaying";
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
const covers = (list: Invalidation[], key: readonly unknown[]) =>
  list.some(i => (i.exact ? JSON.stringify(i.key) === JSON.stringify(key) : isPrefix(i.key, key)));
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

describe("playableTrack — what the now-playing cards may render", () => {
  const track: NowPlayingData = {
    is_playing: true, progress_ms: 1000,
    item: { id: "t", name: "Song", duration_ms: 200000, artists: [{ id: "a", name: "Art" }], album: { id: "al", name: "Alb", images: [] } },
  };
  test("a playing track is returned as is", () => {
    expect(playableTrack(track)).toBe(track);
  });
  test("nothing playing, or a response that is not there, is null", () => {
    expect(playableTrack(null)).toBeNull();
    expect(playableTrack(undefined)).toBeNull();
  });
  test("a paused track is null", () => {
    expect(playableTrack({ ...track, is_playing: false })).toBeNull();
  });
  test("a podcast episode — item null, or an item with no album — is null (this used to crash the app)", () => {
    expect(playableTrack({ ...track, item: null } as unknown as NowPlayingData)).toBeNull();
    expect(playableTrack({ ...track, item: { id: "e", name: "Ep 12", duration_ms: 3_600_000 } } as unknown as NowPlayingData)).toBeNull();
  });
});

describe("toCounts", () => {
  test("reads the three counts", () => {
    expect(toCounts({ track: 3, album: 2, artist: 1 })).toEqual({ track: 3, album: 2, artist: 1 });
    expect(totalOf({ track: 3, album: 2, artist: 1 })).toBe(6);
  });
  test.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "nope"],
    ["an empty object", {}],
  ])("%s becomes all zeros", (_n, v) => {
    expect(toCounts(v)).toEqual(NO_COUNTS);
  });
  test("a malformed field counts as 0, never NaN or negative", () => {
    expect(toCounts({ track: "5", album: NaN, artist: -2 })).toEqual({ track: 0, album: 0, artist: 0 });
    expect(toCounts({ track: 4, album: undefined, artist: Infinity })).toEqual({ track: 4, album: 0, artist: 0 });
  });
});

describe("buildReviewBody — the POST /reviews body", () => {
  const fields = { text: "great", score: 8.5, moods: ["Chill"] };
  const base = { trackName: "Song", artistName: "Artist", albumArt: "http://art" };

  test("a track review carries the track id plus the album and artist ids it knows", () => {
    const b = buildReviewBody({ ...base, type: "track", spotifyTrackId: "t1", spotifyAlbumId: "a1", spotifyArtistId: "r1" }, fields);
    expect(b).toMatchObject({ type: "track", spotifyTrackId: "t1", spotifyAlbumId: "a1", spotifyArtistId: "r1", ...fields, shareToFeed: true, ...base });
  });

  test("a track review leaves out the album and artist ids it does not know", () => {
    const b = buildReviewBody({ ...base, type: "track", spotifyTrackId: "t1" }, fields) as Record<string, unknown>;
    expect(b.spotifyTrackId).toBe("t1");
    expect("spotifyAlbumId" in b).toBe(false);
    expect("spotifyArtistId" in b).toBe(false);
  });

  test("an album review carries only the album id", () => {
    const b = buildReviewBody({ ...base, type: "album", spotifyAlbumId: "a1", spotifyArtistId: "r1", spotifyTrackId: "t1" }, fields) as Record<string, unknown>;
    expect(b).toMatchObject({ type: "album", spotifyAlbumId: "a1" });
    expect("spotifyTrackId" in b).toBe(false);
    expect("spotifyArtistId" in b).toBe(false);
  });

  test("an artist review carries only the artist id", () => {
    const b = buildReviewBody({ ...base, type: "artist", spotifyArtistId: "r1", spotifyAlbumId: "a1" }, fields) as Record<string, unknown>;
    expect(b).toMatchObject({ type: "artist", spotifyArtistId: "r1" });
    expect("spotifyAlbumId" in b).toBe(false);
  });

  test("a type with no matching id falls back to a track review, as before", () => {
    expect(buildReviewBody({ ...base, type: "artist" }, fields)).toMatchObject({ type: "track" });
    expect(buildReviewBody({ ...base }, fields)).toMatchObject({ type: "track" });
  });

  test("the review's text, score, moods and shareToFeed always go along", () => {
    for (const type of ["track", "album", "artist"] as const) {
      const b = buildReviewBody({ ...base, type, spotifyTrackId: "t", spotifyAlbumId: "a", spotifyArtistId: "r" }, fields);
      expect(b).toMatchObject({ text: "great", score: 8.5, moods: ["Chill"], shareToFeed: true });
    }
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
  // A track review carries its album and artist ids too (for the artist link on its card).
  const trackReview = { type: "track", spotifyTrackId: "t1", spotifyAlbumId: "a1", spotifyArtistId: "r1" };

  test("posting a track review refreshes the song's page and everything that lists reviews", () => {
    const list = afterReviewChange(trackReview);
    expect(covers(list, qk.myReviews())).toBe(true);             // "Already reviewed" badges
    expect(covers(list, qk.feed("foryou"))).toBe(true);
    expect(covers(list, qk.feed("following"))).toBe(true);
    expect(covers(list, qk.leaderboard("track", 100))).toBe(true);
    expect(covers(list, qk.trackReviews("t1"))).toBe(true);
    expect(covers(list, qk.meCounts())).toBe(true);
    expect(covers(list, qk.meReviewsSample())).toBe(true);
    expect(covers(list, qk.meReviewsList("all", ""))).toBe(true);
  });

  test("scores are per type: a track review does not touch its album's or artist's page", () => {
    const list = afterReviewChange(trackReview);
    expect(covers(list, qk.album("a1"))).toBe(false);
    expect(covers(list, qk.albumReviews("a1"))).toBe(false);
    expect(covers(list, qk.artist("r1"))).toBe(false);
    expect(covers(list, qk.artistReviews("r1"))).toBe(false);
  });

  test("a review with no type (an old one) is a track", () => {
    const list = afterReviewChange({ spotifyTrackId: "t1" });
    expect(covers(list, qk.trackReviews("t1"))).toBe(true);
  });

  test("it does not refresh unrelated entities", () => {
    const list = afterReviewChange(trackReview);
    expect(covers(list, qk.track("other"))).toBe(false);
    expect(covers(list, qk.album("other"))).toBe(false);
    expect(covers(list, qk.artist("other"))).toBe(false);
    expect(covers(list, qk.notifications())).toBe(false);
  });

  test("an album review touches only the album", () => {
    const list = afterReviewChange({ type: "album", spotifyAlbumId: "a1" });
    expect(covers(list, qk.album("a1"))).toBe(true);
    expect(covers(list, qk.albumReviews("a1"))).toBe(true);
    expect(covers(list, qk.track("t1"))).toBe(false);
    expect(covers(list, qk.artist("r1"))).toBe(false);
  });

  test("an artist review touches only the artist", () => {
    const list = afterReviewChange({ type: "artist", spotifyArtistId: "r1" });
    expect(covers(list, qk.artist("r1"))).toBe(true);
    expect(covers(list, qk.artistReviews("r1"))).toBe(true);
    expect(covers(list, qk.album("a1"))).toBe(false);
  });

  test("the author's profile is refreshed only when the author is known", () => {
    expect(covers(afterReviewChange(trackReview), qk.userCounts("u1"))).toBe(false);
    expect(covers(afterReviewChange({ ...trackReview, authorId: "u1" }), qk.userCounts("u1"))).toBe(true);
  });

  test("editing or deleting your own review refreshes your profile's counts and list, and only yours", () => {
    const list = afterReviewEditOrDelete({ ...trackReview, authorId: "me" });
    expect(covers(list, qk.userCounts("me"))).toBe(true);
    expect(covers(list, qk.userReviewsList("me", "all", ""))).toBe(true);
    expect(covers(list, qk.userCounts("someone-else"))).toBe(false);
    const profile = list.find(i => JSON.stringify(i.key) === JSON.stringify(qk.user("me")));
    expect(profile?.stale).toBeFalsy();                            // refetched if open, not just marked stale
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
    expect(covers(list, qk.user("u1"))).toBe(true);                // the profile record itself
    expect(covers(list, qk.userCounts("u1"))).toBe(false);         // not everything under it: a follow changes neither
    expect(covers(list, qk.userReviewsSample("u1"))).toBe(false);
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
      { queryKey: ["feed"], exact: false, refetchType: "none" },
      { queryKey: ["reviews", "mine"], exact: false, refetchType: "active" },
    ]);
    expect(toFilters([{ key: ["user", "u1"], exact: true }])[0]).toMatchObject({ exact: true });
  });
});

// ── Two web fixes found by express-web reading the web for Spotify ids (plan.md, "Security tests"). ──
// Written as `test.failing` while the web still had the problem; express-web fixed both on 2026-10-17 and the
// markers are gone, so these are plain guards now.

describe("a Spotify local file in the now-playing card", () => {
  // Spotify documents a local file as `is_local` with a null id on the track, its album and its artists. The cards
  // would offer "Rate" (which posts spotifyTrackId: null) and a tap would go to /song/null.
  const local = {
    is_playing: true, progress_ms: 1000,
    item: { id: null, is_local: true, name: "My demo.mp3", duration_ms: 180000, artists: [{ id: null, name: "Me" }], album: { id: null, name: "", images: [] } },
  } as unknown as NowPlayingData;

  test("is treated as nothing playing, like a podcast", () => {
    expect(playableTrack(local)).toBeNull();
  });
});

describe("buildReviewBody with a track that has no id", () => {
  const target = { type: "track" as const, trackName: "Song", artistName: "Artist", albumArt: "" };

  test("sends no spotifyTrackId at all, rather than null", () => {
    const body = buildReviewBody({ ...target, spotifyTrackId: null as unknown as string }, { text: "", score: 5, moods: [] });
    expect(body).not.toHaveProperty("spotifyTrackId", null);
  });
});
