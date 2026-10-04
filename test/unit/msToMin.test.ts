import { msToMin } from "../../shared/format";

describe("msToMin", () => {
  test.each([
    [0, "0:00"],
    [999, "0:00"],            // floors, never rounds up
    [1000, "0:01"],
    [59999, "0:59"],          // 59.999s is still 0:59
    [60000, "1:00"],
    [61000, "1:01"],
    [3599000, "59:59"],       // last second before an hour
    [3600000, "1:00:00"],     // hours kick in at exactly 60 minutes
    [3661000, "1:01:01"],
    [36000000, "10:00:00"],   // e.g. a 10-hour ambient/sleep track
    [123456789, "34:17:36"],  // hours keep counting, no day rollover
  ])("%d ms -> %s", (ms, expected) => expect(msToMin(ms)).toBe(expected));
});
