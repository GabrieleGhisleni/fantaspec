import { dateRange, dayTime, kickoffTime, num1, perGame, playerCount, startClass, tertile } from "./format";

test("italian number format", () => {
  expect(num1(6.5)).toBe("6,5"); expect(num1(null)).toBe("–");
});

test("num1 always shows one decimal", () => {
  expect(num1(6)).toBe("6,0");
  expect(num1(1.666)).toBe("1,7");
  expect(num1(0)).toBe("0,0");
});

test("per game average", () => {
  expect(perGame(14, 9)).toBeCloseTo(1.556, 3);
  expect(perGame(0, 9)).toBe(0);
  expect(perGame(5, 0)).toBe(0);
});

test("tertile colouring", () => {
  const all = [0.8, 1.0, 1.2, 1.4, 1.6, 2.0];
  expect(tertile(2.0, all, true)).toBe("good"); expect(tertile(0.8, all, true)).toBe("bad"); expect(tertile(2.0, all, false)).toBe("bad");
});

test("tertile: lower is good, middle and flat lists stay neutral", () => {
  const all = [0.8, 1.0, 1.2, 1.4, 1.6, 2.0];
  expect(tertile(0.8, all, false)).toBe("good");
  expect(tertile(1.2, all, true)).toBe("");
  expect(tertile(1.2, all, false)).toBe("");
  expect(tertile(1, [1, 1, 1, 1], true)).toBe("");
  expect(tertile(1, [1, 2], true)).toBe("");
  expect(tertile(1, [], true)).toBe("");
});

test("tertile over 20 clubs marks about a third on each side", () => {
  const all = Array.from({ length: 20 }, (_, i) => 0.5 + i * 0.1);
  const marks = all.map(v => tertile(v, all, true));
  expect(marks.filter(m => m === "good").length).toBeGreaterThanOrEqual(6);
  expect(marks.filter(m => m === "bad").length).toBeGreaterThanOrEqual(6);
  expect(marks.filter(m => m === "").length).toBeGreaterThanOrEqual(6);
  expect(marks[0]).toBe("bad"); expect(marks[19]).toBe("good");
});

test("start percentage classes", () => {
  expect(startClass(75)).toBe("good"); expect(startClass(100)).toBe("good");
  expect(startClass(74)).toBe(""); expect(startClass(50)).toBe("");
  expect(startClass(49)).toBe("bad"); expect(startClass(0)).toBe("bad");
  expect(startClass(null)).toBe("");
});

test("matchday date range", () => {
  expect(dateRange("2026-10-31", "2026-11-02")).toBe("31 ott – 2 nov");
  expect(dateRange("2026-12-29", "2027-01-01")).toBe("29 dic – 1 gen");
  expect(dateRange("2026-10-31", "2026-10-31")).toBe("31 ott");
});

test("date and time are shown in Rome time, whatever the browser's zone", () => {
  expect(dayTime("2026-10-31T10:07:12+01:00")).toBe("31 ott 10:07");
  expect(dayTime("2026-10-30T18:05:00Z")).toBe("30 ott 19:05");
  expect(dayTime("2026-07-01T08:00:00Z")).toBe("1 lug 10:00"); // summer time
  expect(dayTime("2026-10-31T23:30:00Z")).toBe("1 nov 00:30");
});

test("kickoff with the weekday", () => {
  expect(kickoffTime("2026-10-31T18:00:00+01:00")).toBe("sab 31 ott 18:00");
  expect(kickoffTime("2026-11-01T19:45:00Z")).toBe("dom 1 nov 20:45");
});

test("player counts agree in number", () => {
  expect(playerCount(0)).toBe("0 giocatori");
  expect(playerCount(1)).toBe("1 giocatore");
  expect(playerCount(29)).toBe("29 giocatori");
});
