import { toSpotifyPage, nextSpotifyOffset, joinSpotifyPages, spotifyPaging, SPOTIFY_MAX_OFFSET, type SpotifyPage } from "../../web/src/queries/spotifyPaging";
import { flattenUniqueBy, flattenUnique } from "../../web/src/queries/pagination";

// The paging rule for Spotify's own paging object (plan.md, step 2b; `express-architect`):
//   hasMore    = next != null && items.length > 0 && nextOffset <= 1000      (presence only, never follow the URL)
//   nextOffset = offset + items.length                                        (not + limit: Search can return a short page)
//   total      = for display only (Search's drifts: 10, then 18, then 22 for the same query)
//   overlap    = Search's window moves, so pages can overlap: de-duplicate by id when joining

type Item = { id: string; name?: string };
const NEXT = "https://api.spotify.com/v1/search?offset=10&limit=10"; // a `next` link; the code only checks that one exists
const page = (over: Partial<SpotifyPage<Item>> = {}): SpotifyPage<Item> => ({ items: [], total: 0, limit: 10, offset: 0, next: null, ...over });
const items = (n: number, from = 0): Item[] => Array.from({ length: n }, (_, i) => ({ id: `id${from + i}` }));

describe("toSpotifyPage — reads a paging object defensively", () => {
    it("keeps a well-formed page as it is", () => {
        const raw = { items: [{ id: "a" }], total: 54, limit: 10, offset: 20, next: NEXT };
        expect(toSpotifyPage<Item>(raw)).toEqual(raw);
    });

    it.each([null, undefined, {}, "x", 42, []])("turns %p into an empty last page", (raw) => {
        expect(toSpotifyPage<Item>(raw)).toEqual({ items: [], total: 0, limit: 0, offset: 0, next: null });
    });

    it.each(["x", null, {}, 5])("treats items that are %p as an empty list", (value) => {
        expect(toSpotifyPage<Item>({ items: value, total: 7 }).items).toEqual([]);
    });

    it.each([NaN, Infinity, -Infinity, "10", null, undefined])("treats a total, limit or offset of %p as 0", (value) => {
        const p = toSpotifyPage<Item>({ items: items(3), total: value, limit: value, offset: value });
        expect(p.limit).toBe(0);
        expect(p.offset).toBe(0);
        expect(p.total).toBe(3); // a missing total falls back to what is loaded
    });

    it.each([null, undefined, 5, {}, false])("treats a next of %p as no next page", (value) => {
        expect(toSpotifyPage<Item>({ items: items(2), next: value }).next).toBeNull();
    });
});

describe("nextSpotifyOffset — is there another page, and where does it start", () => {
    it("continues from offset + the items that came back", () => {
        expect(nextSpotifyOffset(page({ items: items(10), offset: 0, next: NEXT }))).toBe(10);
        expect(nextSpotifyOffset(page({ items: items(10), offset: 30, next: NEXT }))).toBe(40);
    });

    it("advances by the items returned on a short page, not by the limit", () => {
        expect(nextSpotifyOffset(page({ items: items(7), limit: 10, offset: 20, next: NEXT }))).toBe(27);
    });

    it("stops on the last page, where Spotify's next is null", () => {
        expect(nextSpotifyOffset(page({ items: items(4), offset: 50, next: null }))).toBeUndefined();
    });

    it("stops on an empty page even when Spotify still gives a next link (no endless loop)", () => {
        expect(nextSpotifyOffset(page({ items: [], offset: 40, next: NEXT }))).toBeUndefined();
    });

    it("never asks for an offset above Spotify's cap of 1000", () => {
        expect(SPOTIFY_MAX_OFFSET).toBe(1000);
        expect(nextSpotifyOffset(page({ items: items(5), offset: 995, next: NEXT }))).toBe(1000);     // lands exactly on the cap
        expect(nextSpotifyOffset(page({ items: items(10), offset: 990, next: NEXT }))).toBe(1000);
        expect(nextSpotifyOffset(page({ items: items(5), offset: 996, next: NEXT }))).toBeUndefined(); // 1001
        expect(nextSpotifyOffset(page({ items: items(10), offset: 1000, next: NEXT }))).toBeUndefined();
    });

    it("does not look at the total, which Search keeps changing", () => {
        // total says 5 but ten items arrived and a next link exists: keep going
        expect(nextSpotifyOffset(page({ items: items(10), total: 5, offset: 0, next: NEXT }))).toBe(10);
        // total says 999 but there is no next link: stop
        expect(nextSpotifyOffset(page({ items: items(10), total: 999, offset: 0, next: null }))).toBeUndefined();
    });

    it("does not look at the limit either", () => {
        expect(nextSpotifyOffset(page({ items: items(3), limit: 0, offset: 0, next: NEXT }))).toBe(3);
    });
});

describe("joinSpotifyPages — one list from the loaded pages (the query's select)", () => {
    it("keeps the order and drops an id that an earlier page already had", () => {
        const joined = joinSpotifyPages({ pages: [page({ items: [{ id: "a" }, { id: "b" }, { id: "c" }] }), page({ items: [{ id: "c" }, { id: "d" }] })] });
        expect(joined.items.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
    });

    it("lets the first copy win", () => {
        const joined = joinSpotifyPages({ pages: [page({ items: [{ id: "c", name: "first" }] }), page({ items: [{ id: "c", name: "second" }] })] });
        expect(joined.items).toEqual([{ id: "c", name: "first" }]);
    });

    it("takes the total from the first page, so a drifting later total does not change it", () => {
        const joined = joinSpotifyPages({ pages: [page({ items: items(10), total: 18 }), page({ items: items(10, 10), total: 22 })] });
        expect(joined.total).toBe(18);
    });

    it("is empty, with a total of 0, when nothing was loaded", () => {
        expect(joinSpotifyPages<Item>({ pages: [] })).toEqual({ items: [], total: 0 });
        expect(joinSpotifyPages<Item>({ pages: [page()] })).toEqual({ items: [], total: 0 });
    });
});

describe("spotifyPaging — what useInfiniteQuery is given", () => {
    it("starts at offset 0 and asks nextSpotifyOffset for what follows", () => {
        expect(spotifyPaging.initialPageParam).toBe(0);
        expect(spotifyPaging.getNextPageParam).toBe(nextSpotifyOffset);
    });
});

describe("walking a whole list, the way TanStack Query does", () => {
    // `serve` is a fake Spotify: a catalogue, a limit and an offset in; a paging object out.
    const serve = (catalogue: Item[], offset: number, limit: number) =>
        toSpotifyPage<Item>({ items: catalogue.slice(offset, offset + limit), total: catalogue.length, limit, offset, next: offset + limit < catalogue.length ? NEXT : null });

    const walk = (catalogue: Item[], limit: number) => {
        const pages: SpotifyPage<Item>[] = [];
        const asked: number[] = [];
        let param: number | undefined = spotifyPaging.initialPageParam;
        while (param !== undefined && pages.length < 500) {
            asked.push(param);
            pages.push(serve(catalogue, param, limit));
            param = spotifyPaging.getNextPageParam(pages[pages.length - 1]);
        }
        return { pages, asked };
    };

    it("reads a 54-album catalogue in six pages of 10 and then stops", () => {
        const { pages, asked } = walk(items(54), 10);

        expect(pages).toHaveLength(6);
        expect(asked).toEqual([0, 10, 20, 30, 40, 50]);
        const joined = joinSpotifyPages({ pages });
        expect(joined.items).toHaveLength(54);
        expect(joined.total).toBe(54);
    });

    it("stops at once for a list that fits on one page", () => {
        expect(walk(items(4), 10).pages).toHaveLength(1);
        expect(walk([], 10).pages).toHaveLength(1);
    });

    it("never asks for an offset above 1000, however long the catalogue is", () => {
        const { asked } = walk(items(5000), 10);

        expect(Math.max(...asked)).toBeLessThanOrEqual(1000);
        expect(asked.length).toBeLessThan(500); // it ended by itself, not by the test's safety stop
    });

    it("copes with Search's window moving: overlapping pages are joined without duplicates", () => {
        // each call's window has slid forward by one item, so the page after [0..9] is [9..18]
        const pages = [page({ items: items(10, 0), offset: 0, next: NEXT }), page({ items: items(10, 9), offset: 10, next: null })];

        const joined = joinSpotifyPages({ pages });

        expect(joined.items.map((i) => i.id)).toEqual(Array.from({ length: 19 }, (_, i) => `id${i}`));
    });
});

describe("flattenUniqueBy — the generic version, which flattenUnique now delegates to", () => {
    const byId = (i: Item) => i.id;

    it("de-duplicates by whatever key it is given, first wins, order kept", () => {
        const out = flattenUniqueBy([[{ id: "a", name: "1" }, { id: "b" }], [{ id: "a", name: "2" }, { id: "c" }]], (p) => p, byId);
        expect(out).toEqual([{ id: "a", name: "1" }, { id: "b" }, { id: "c" }]);
    });

    it("gives an empty list for no pages", () => {
        expect(flattenUniqueBy<Item[], Item>(undefined, (p) => p, byId)).toEqual([]);
        expect(flattenUniqueBy<Item[], Item>([], (p) => p, byId)).toEqual([]);
    });

    it("lets the key function decide what counts as the same", () => {
        const out = flattenUniqueBy([[{ id: "a", name: "Same" }, { id: "b", name: "Same" }]], (p) => p, (i) => i.name ?? "");
        expect(out).toEqual([{ id: "a", name: "Same" }]);
    });

    it("flattenUnique still de-duplicates reviews by _id, as before", () => {
        const out = flattenUnique([{ items: [{ _id: "1" }, { _id: "2" }] }, { items: [{ _id: "2" }, { _id: "3" }] }], (p) => p.items);
        expect(out.map((r) => r._id)).toEqual(["1", "2", "3"]);
    });
});
