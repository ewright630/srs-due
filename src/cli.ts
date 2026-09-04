#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseCardLine, type Card } from "./card.js";
import { evaluate, sortByUrgency } from "./due.js";

interface Source {
  name: string;
  path: string | null; // null means stdin
}

function usage(): string {
  return [
    "usage: srs-due [--asof DATE] [FILE...]",
    "",
    "Reads spaced-repetition card state (one JSON object per line) from FILE",
    "arguments, or from stdin if no files are given, and prints which cards",
    "are due for review as of DATE (default: now).",
    "",
    "Each line looks like:",
    '  {"id":"card-1","last_review":"2026-08-30","interval_days":6}',
  ].join("\n");
}

function readSource(source: Source): string {
  if (source.path === null) {
    if (process.stdin.isTTY) {
      throw new Error(
        "no input files given and stdin is a terminal; pipe input or pass file arguments"
      );
    }
    return readFileSync(0, "utf8");
  }
  return readFileSync(source.path, "utf8");
}

function parseCards(sources: Source[]): Card[] {
  const cards: Card[] = [];
  for (const source of sources) {
    const text = readSource(source);
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? "";
      if (line.length === 0) continue;
      cards.push(parseCardLine(line, source.name, i + 1));
    }
  }
  return cards;
}

function formatDays(n: number): string {
  if (n > 0) return `${n} day${n === 1 ? "" : "s"} overdue`;
  if (n === 0) return "due today";
  const until = -n;
  return `due in ${until} day${until === 1 ? "" : "s"}`;
}

function parseArgs(argv: string[]): { asOf: Date; files: string[] } | { help: true } {
  let asOf = new Date();
  const files: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--asof") {
      const value = argv[++i];
      if (value === undefined) {
        throw new Error("--asof requires a date argument");
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error(`--asof: "${value}" is not a valid date`);
      }
      asOf = parsed;
    } else if (arg === "--help" || arg === "-h") {
      return { help: true };
    } else if (arg?.startsWith("--")) {
      throw new Error(`unknown option: ${arg}`);
    } else if (arg !== undefined) {
      files.push(arg);
    }
  }

  return { asOf, files };
}

function main(argv: string[]): number {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }

  if ("help" in parsed) {
    console.log(usage());
    return 0;
  }
  const { asOf, files } = parsed;

  const sources: Source[] =
    files.length > 0
      ? files.map((path) => ({ name: path, path }))
      : [{ name: "<stdin>", path: null }];

  let cards: Card[];
  try {
    cards = parseCards(sources);
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }

  if (cards.length === 0) {
    console.log("no cards given");
    return 0;
  }

  const evaluated = sortByUrgency(evaluate(cards, asOf));
  const due = evaluated.filter((d) => d.daysOverdue >= 0);
  const upcoming = evaluated.filter((d) => d.daysOverdue < 0);

  for (const d of due) {
    console.log(`${d.card.id}\t${d.dueDate.toISOString().slice(0, 10)}\t${formatDays(d.daysOverdue)}`);
  }
  if (due.length > 0 && upcoming.length > 0) {
    console.log("");
  }
  for (const d of upcoming) {
    console.log(`${d.card.id}\t${d.dueDate.toISOString().slice(0, 10)}\t${formatDays(d.daysOverdue)}`);
  }

  console.log("");
  console.log(`${due.length} of ${cards.length} card${cards.length === 1 ? "" : "s"} due`);

  return 0;
}

process.exit(main(process.argv.slice(2)));
