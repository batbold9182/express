import { hasScore, formatScore, NO_SCORE_COLOR } from "../../web/src/lib/score";
import { tasteStats } from "../../web/src/lib/taste";

// The API accepts a review with no score (security.md, web High 1), so every place the web prints one goes through
// web/src/lib/score.ts instead of calling `.toFixed` on it, and the taste snapshot ignores such a review.

describe("hasScore", () => {
    it.each([0, 5, 8.5, 10])("accepts %p", (n) => {
        expect(hasScore(n)).toBe(true);
    });

    it.each([undefined, null, NaN, Infinity, "8.5", "", true, {}])("refuses %p", (value) => {
        expect(hasScore(value)).toBe(false);
    });
});

describe("formatScore", () => {
    it.each([
        [8.5, "8.5"],
        [10, "10.0"],
        [0, "0.0"],
        [7, "7.0"],
        [8.54, "8.5"],
        [8.56, "8.6"],
    ])("shows %p as %s", (score, shown) => {
        expect(formatScore(score)).toBe(shown);
    });

    it.each([undefined, null, NaN, Infinity, "8.5", {}])("shows a dash for %p, never a crash or \"NaN\"", (value) => {
        expect(formatScore(value)).toBe("—");
    });

    it("has a colour for a review with no score", () => {
        expect(NO_SCORE_COLOR).toMatch(/^#[0-9a-f]{6}$/i);
    });
});

describe("tasteStats", () => {
    // Only the fields tasteStats reads.
    const review = (score: unknown, name = "Song") => ({ trackName: name, score }) as never;

    it("is empty for no reviews", () => {
        const t = tasteStats([]);

        expect(t.count).toBe(0);
        expect(t.avg).toBeNull();
        expect(t.favorites).toEqual([]);
        expect(t.dist).toEqual(Array(10).fill(0));
    });

    it("averages the scores, counts them and fills the 1 to 10 histogram", () => {
        const t = tasteStats([review(8), review(10), review(6)]);

        expect(t.count).toBe(3);
        expect(t.avg).toBe(8);
        expect(t.dist[5]).toBe(1); // a 6
        expect(t.dist[7]).toBe(1); // an 8
        expect(t.dist[9]).toBe(1); // a 10
        expect(t.maxDist).toBe(1);
    });

    it("keeps the four best as favourites, best first", () => {
        const t = tasteStats([review(5, "e"), review(9, "a"), review(7, "c"), review(10, "z"), review(8, "b"), review(6, "d")]);

        expect(t.favorites.map((r: { trackName: string }) => r.trackName)).toEqual(["z", "a", "b", "c"]);
    });

    // A review with no score counts for nothing: not in the number of reviews, the average, the histogram or the favourites.
    it("ignores a review without a score", () => {
        const t = tasteStats([review(8, "kept"), review(undefined, "none"), review(null, "null"), review(NaN, "nan"), review("9", "string")]);

        expect(t.count).toBe(1);
        expect(t.avg).toBe(8);
        expect(t.dist.reduce((a: number, b: number) => a + b, 0)).toBe(1);
        expect(t.favorites.map((r: { trackName: string }) => r.trackName)).toEqual(["kept"]);
    });

    // The slider and the model allow 0 to 10 (the user rates with 0). Bar n of the histogram is "about n + 1": every score from 0 to
    // 1.4 is in the first bar and 9.5 to 10 in the last, so each scored review is in exactly one bar. (A 0 used to be dropped from
    // the histogram while still counting in the average: on /me, 5 reviews with an average of 5.6 showed only 3 in "How you rate".)
    it.each([
        [0, 0],
        [0.4, 0],
        [0.5, 0], // rounds to 1
        [1, 0],
        [1.4, 0],
        [1.5, 1], // rounds to 2
        [5, 4],
        [9.4, 8],
        [9.5, 9], // rounds to 10
        [10, 9],
    ])("puts a score of %p in bar %i", (score, bar) => {
        const t = tasteStats([review(score)]);

        expect(t.dist[bar]).toBe(1);
        expect(t.dist.reduce((a: number, b: number) => a + b, 0)).toBe(1);
        expect(t.count).toBe(1);
    });

    it("shows every scored review in the histogram: the bars add up to the count", () => {
        const scores = [0, 0.3, 1, 2.5, 4, 5.5, 6, 7.5, 8, 9, 9.7, 10];

        const t = tasteStats(scores.map((s) => review(s)));

        expect(t.count).toBe(scores.length);
        expect(t.dist.reduce((a: number, b: number) => a + b, 0)).toBe(t.count);
    });

    it("counts a 0 in the average as well as in the histogram", () => {
        const t = tasteStats([review(0), review(10)]);

        expect(t.avg).toBe(5);
        expect(t.dist[0]).toBe(1);
        expect(t.dist[9]).toBe(1);
    });

    it("is empty when every review lacks a score, without dividing by zero", () => {
        const t = tasteStats([review(undefined), review(null)]);

        expect(t.count).toBe(0);
        expect(t.avg).toBeNull();
        expect(t.favorites).toEqual([]);
    });
});
