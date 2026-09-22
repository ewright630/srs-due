import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCardLine } from "./card.js";

test("parses a minimal valid line", () => {
  const card = parseCardLine(
    '{"id":"a","last_review":"2026-08-30","interval_days":6}',
    "test",
    1
  );
  assert.equal(card.id, "a");
  assert.equal(card.lastReview.toISOString(), new Date("2026-08-30").toISOString());
  assert.equal(card.intervalDays, 6);
  assert.equal(card.ease, undefined);
  assert.equal(card.repetitions, undefined);
});

test("parses optional ease and repetitions", () => {
  const card = parseCardLine(
    '{"id":"a","last_review":"2026-08-30","interval_days":6,"ease":2.3,"repetitions":4}',
    "test",
    1
  );
  assert.equal(card.ease, 2.3);
  assert.equal(card.repetitions, 4);
});

test("rejects invalid JSON", () => {
  assert.throws(() => parseCardLine("not json", "test", 1), /invalid JSON/);
});

test("rejects a JSON array", () => {
  assert.throws(() => parseCardLine("[]", "test", 1), /expected a JSON object/);
});

test("rejects a missing id", () => {
  assert.throws(
    () => parseCardLine('{"last_review":"2026-08-30","interval_days":6}', "test", 1),
    /missing or invalid "id"/
  );
});

test("rejects an unparseable last_review", () => {
  assert.throws(
    () => parseCardLine('{"id":"a","last_review":"not a date","interval_days":6}', "test", 1),
    /"last_review" is not a valid date/
  );
});

test("rejects a negative interval_days", () => {
  assert.throws(
    () => parseCardLine('{"id":"a","last_review":"2026-08-30","interval_days":-1}', "test", 1),
    /missing or invalid "interval_days"/
  );
});

test("rejects a non-integer repetitions", () => {
  assert.throws(
    () =>
      parseCardLine(
        '{"id":"a","last_review":"2026-08-30","interval_days":6,"repetitions":1.5}',
        "test",
        1
      ),
    /"repetitions" must be a non-negative integer/
  );
});

test("error messages include source and line number", () => {
  assert.throws(() => parseCardLine("not json", "cards/spanish.jsonl", 12), /cards\/spanish\.jsonl:12:/);
});
