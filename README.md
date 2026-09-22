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
- `ease` (number, optional) - SM-2 ease factor; defaults to 2.5 for a card
  that has never been graded.
- `repetitions` (number, optional) - consecutive successful SM-2 reviews;
  defaults to 0.

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

Or get the same data as a single JSON object, for scripting:

```
cat cards/*.jsonl | node dist/cli.js --format json --asof 2026-09-10
{"cards":[{"id":"kanji-water","due_date":"2026-09-05","days_overdue":1,"status":"overdue"}, ...],"due_count":2,"total_count":3}
```

### Recording a grade

After you review a card, record how well you recalled it (SM-2 scale,
0-5) and get back the rescheduled card state:

```
cat cards/spanish.jsonl | node dist/cli.js grade spanish-ser-vs-estar 4
{"id":"spanish-ser-vs-estar","last_review":"2026-09-08T14:03:11.000Z","interval_days":6,"ease":2.5,"repetitions":2}
```

This only prints the updated line - it doesn't rewrite the input file.
Pipe it wherever you're keeping card state, or splice it back in by hand.
`--asof` works here too, for backdating a review or replaying a log.

## Development

```
npm test
```

Runs the suite with `node --test`, using explicit `Date` objects
throughout instead of the system clock, so results don't drift with
when you happen to run them.

## Roadmap

Directory input with glob expansion, and a `--days-ahead` range query
for upcoming load.
