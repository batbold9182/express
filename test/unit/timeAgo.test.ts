import { timeAgo } from "../../shared/timeAgo";

describe("timeAgo", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-04T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("returns just now for less than 1 minute", () => {
    expect(timeAgo("2026-10-04T11:59:30Z")).toBe("just now");
  });

  test("returns minutes", () => {
    expect(timeAgo("2026-10-04T11:45:00Z")).toBe("15m");
  });

  test("returns hours", () => {
    expect(timeAgo("2026-10-04T09:00:00Z")).toBe("3h");
  });

  test("returns days", () => {
    expect(timeAgo("2026-10-02T12:00:00Z")).toBe("2d");
  });
  test.each([
    ["2026-10-04T11:59:01Z", "just now"], // 59s
    ["2026-10-04T11:59:00Z", "1m"],       // 60s
    ["2026-10-04T11:00:01Z", "59m"],
    ["2026-10-04T11:00:00Z", "1h"],
    ["2026-10-03T12:01:00Z", "23h"],
    ["2026-10-03T12:00:00Z", "1d"],
  ])("%s -> %s", (iso, expected) => expect(timeAgo(iso)).toBe(expected));
  test("treats a future timestamp as just now", () => {
    expect(timeAgo("2026-10-04T13:00:00Z")).toBe("just now");
  });

  // An unparseable date shows nothing rather than claiming an age ("NaNd" before, "just now" would be a lie).
  test.each([["not-a-date"], [""]])("returns an empty string for invalid input %j", (iso) => {
    expect(timeAgo(iso)).toBe("");
  });
});