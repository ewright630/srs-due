import { test } from "node:test";
import assert from "node:assert/strict";
import type { Card } from "./card.js";
import { dueDateOf, evaluate, sortByUrgency } from "./due.js";

function card(overrides: Partial<Card> & { id: string }): Card {
  return {
    lastReview: new Date("2026-09-01T00:00:00.000Z"),
    intervalDays: 1,
    ...overrides,
  };
}

test("dueDateOf adds interval_days to last_review", () => {
  const c = card({ id: "a", lastReview: new Date("2026-09-01T00:00:00.000Z"), intervalDays: 6 });
  assert.equal(dueDateOf(c).toISOString(), "2026-09-07T00:00:00.000Z");
});

test("evaluate reports 0 for a card due exactly now", () => {
  const asOf = new Date("2026-09-07T00:00:00.000Z");
  const c = card({ id: "a", lastReview: new Date("2026-09-01T00:00:00.000Z"), intervalDays: 6 });
  const [result] = evaluate([c], asOf);
  assert.equal(result.daysOverdue, 0);
});

test("evaluate floors overdue days rather than rounding", () => {
  // Due at 2026-09-07T00:00:00Z, checked one minute before the next day
  // rolls over: should read as 0 days overdue, not 1 from rounding.
  const asOf = new Date("2026-09-07T23:59:00.000Z");
  const c = card({ id: "a", lastReview: new Date("2026-09-01T00:00:00.000Z"), intervalDays: 6 });
  const [result] = evaluate([c], asOf);
  assert.equal(result.daysOverdue, 0);

  const dayLater = new Date("2026-09-08T23:59:00.000Z");
  const [resultLater] = evaluate([c], dayLater);
  assert.equal(resultLater.daysOverdue, 1);
});

test("evaluate reports negative days for a card not yet due", () => {
  const asOf = new Date("2026-09-05T00:00:00.000Z");
  const c = card({ id: "a", lastReview: new Date("2026-09-01T00:00:00.000Z"), intervalDays: 6 });
  const [result] = evaluate([c], asOf);
  assert.equal(result.daysOverdue, -2);
});

test("sortByUrgency puts the most overdue first and soonest-upcoming last", () => {
  const asOf = new Date("2026-09-10T00:00:00.000Z");
  const cards = [
    card({ id: "soon", lastReview: new Date("2026-09-01T00:00:00.000Z"), intervalDays: 15 }),
    card({ id: "very-overdue", lastReview: new Date("2026-09-01T00:00:00.000Z"), intervalDays: 1 }),
    card({ id: "far", lastReview: new Date("2026-09-01T00:00:00.000Z"), intervalDays: 20 }),
    card({ id: "a-bit-overdue", lastReview: new Date("2026-09-01T00:00:00.000Z"), intervalDays: 8 }),
  ];
  const sorted = sortByUrgency(evaluate(cards, asOf));
  assert.deepEqual(
    sorted.map((d) => d.card.id),
    ["very-overdue", "a-bit-overdue", "soon", "far"]
  );
});

test("sortByUrgency does not mutate its input", () => {
  const asOf = new Date("2026-09-10T00:00:00.000Z");
  const cards = [
    card({ id: "a", intervalDays: 1 }),
    card({ id: "b", intervalDays: 2 }),
  ];
  const evaluated = evaluate(cards, asOf);
  const original = [...evaluated];
  sortByUrgency(evaluated);
  assert.deepEqual(evaluated, original);
});
