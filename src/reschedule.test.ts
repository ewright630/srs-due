import { test } from "node:test";
import assert from "node:assert/strict";
import type { Card } from "./card.js";
import { applyGrade, DEFAULT_EASE, MIN_EASE } from "./reschedule.js";

const NOW = new Date("2026-09-08T14:03:11.000Z");

function newCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "spanish-ser-vs-estar",
    lastReview: new Date("2026-09-01T00:00:00.000Z"),
    intervalDays: 3,
    ...overrides,
  };
}

test("applyGrade stamps last_review with the injected clock", () => {
  const result = applyGrade(newCard(), 4, NOW);
  assert.equal(result.last_review, NOW.toISOString());
});

test("a first-time pass sets interval to 1 day", () => {
  const result = applyGrade(newCard({ repetitions: 0 }), 4, NOW);
  assert.equal(result.interval_days, 1);
  assert.equal(result.repetitions, 1);
});

test("a second consecutive pass sets interval to 6 days", () => {
  const result = applyGrade(newCard({ repetitions: 1 }), 4, NOW);
  assert.equal(result.interval_days, 6);
  assert.equal(result.repetitions, 2);
});

test("a third consecutive pass multiplies the prior interval by ease", () => {
  const result = applyGrade(newCard({ repetitions: 2, intervalDays: 6, ease: 2.5 }), 4, NOW);
  assert.equal(result.interval_days, 15);
  assert.equal(result.repetitions, 3);
});

test("a failed grade resets repetitions but not ease", () => {
  const result = applyGrade(newCard({ repetitions: 5, ease: 2.8 }), 1, NOW);
  assert.equal(result.repetitions, 0);
  assert.equal(result.interval_days, 1);
  assert.ok(result.ease < 2.8, "a failed recall should still lower ease");
});

test("ease defaults to DEFAULT_EASE for an ungraded card", () => {
  const result = applyGrade(newCard(), 3, NOW);
  assert.ok(result.ease <= DEFAULT_EASE);
});

test("ease never drops below MIN_EASE", () => {
  const result = applyGrade(newCard({ ease: MIN_EASE }), 0, NOW);
  assert.equal(result.ease, MIN_EASE);
});

test("a perfect grade raises ease", () => {
  const result = applyGrade(newCard({ ease: 2.5 }), 5, NOW);
  assert.ok(result.ease > 2.5);
});

test("rejects grades outside 0-5", () => {
  assert.throws(() => applyGrade(newCard(), 6, NOW), /grade must be an integer from 0 to 5/);
  assert.throws(() => applyGrade(newCard(), -1, NOW), /grade must be an integer from 0 to 5/);
  assert.throws(() => applyGrade(newCard(), 2.5, NOW), /grade must be an integer from 0 to 5/);
});
