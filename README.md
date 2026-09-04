# srs-due

A command that answers one question: given a set of spaced-repetition
cards, which ones are due for review right now, and by how much?

Most flashcard apps bury this behind a UI or a database you can't easily
script against. If your cards live in a plain export (Anki, a homemade
JSON deck, a notes app with front-matter) you sometimes just want to pipe
that data into something and get a due list back, in a shell script, a
cron job, or a dashboard.

## Input format

One JSON object per line (JSONL), not a JSON array, so files from
different sources can be concatenated with `cat`:

```
{"id":"spanish-ser-vs-estar","last_review":"2026-08-30","interval_days":6}
{"id":"spanish-subjunctive","last_review":"2026-09-01","interval_days":3}
{"id":"kanji-water","last_review":"2026-09-04","interval_days":1,"ease":2.3}
```

Fields:

- `id` (string, required) - card identifier.
- `last_review` (string, required) - anything `Date` can parse; ISO 8601
  dates and datetimes both work.
- `interval_days` (number, required) - days from `last_review` until the
  card is next due.
- `ease` (number, optional) - carried through but not used yet; see
  Roadmap below.

A card is due once `last_review + interval_days` has passed.

## Usage

Build once:

```
npm run build
```

Then read from files:

```
node dist/cli.js cards/spanish.jsonl cards/kanji.jsonl
```

Or from stdin, which is the point:

```
cat cards/*.jsonl | node dist/cli.js
```

Sample output:

```
kanji-water     2026-09-05      1 day overdue
spanish-ser-vs-estar   2026-09-05      due today
spanish-subjunctive    2026-09-04      due today

2 of 3 cards due
```

Pin the current time for reproducible output (useful in tests or when
replaying an old export):

```
cat cards/*.jsonl | node dist/cli.js --asof 2026-09-10
```

## Roadmap

Proper SM-2 rescheduling after a grade is recorded, a `--format json`
output mode, and a test suite that doesn't require a real clock.
