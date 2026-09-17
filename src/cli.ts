#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseCardLine, type Card } from "./card.js";
import { evaluate, sortByUrgency } from "./due.js";
import { applyGrade } from "./reschedule.js";

interface Source {
  name: string;
  path: string | null; // null means stdin
}

function usage(): string {
  return [
    "usage: srs-due [--asof DATE] [--format table|json] [FILE...]",
    "       srs-due grade CARD_ID SCORE [--asof DATE] [FILE...]",
    "",
    "Reads spaced-repetition card state (one JSON object per line) from FILE",
    "arguments, or from stdin if no files are given, and prints which cards",
    "are due for review as of DATE (default: now).",
    "",
    "Each line looks like:",
    '  {"id":"card-1","last_review":"2026-08-30","interval_days":6}',
    "",
    "--format json prints a single JSON object instead of the tab-separated",
    "table, for piping into another program.",
    "",
    "Run `srs-due grade --help` for the SM-2 rescheduling subcommand.",
  ].join("\n");
}

function gradeUsage(): string {
  return [
    "usage: srs-due grade CARD_ID SCORE [--asof DATE] [FILE...]",
    "",
    "Reads card state the same way the default query does, finds the card",
    "with id CARD_ID, applies an SM-2 update for SCORE, and prints the",
    "resulting JSONL line with the new last_review, interval_days, ease,",
    "and repetitions. Nothing is written back to the input files - redirect",
    "the output wherever you keep card state.",
    "",
    "SCORE follows the SM-2 recall-quality scale, 0 to 5:",
    "  5 - perfect recall",
    "  4 - correct, after hesitation",
    "  3 - correct, but with real difficulty",
    "  2 - incorrect, but felt familiar once shown",
    "  1 - incorrect, remembered on seeing the answer",
    "  0 - complete blackout",
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

type OutputFormat = "table" | "json";

function statusOf(daysOverdue: number): "overdue" | "due_today" | "upcoming" {
  if (daysOverdue > 0) return "overdue";
  if (daysOverdue === 0) return "due_today";
  return "upcoming";
}

function parseArgs(
  argv: string[]
): { asOf: Date; files: string[]; format: OutputFormat } | { help: true } {
  let asOf = new Date();
  let format: OutputFormat = "table";
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
    } else if (arg === "--format") {
      const value = argv[++i];
      if (value !== "table" && value !== "json") {
        throw new Error(`--format must be "table" or "json", got "${value}"`);
      }
      format = value;
    } else if (arg === "--help" || arg === "-h") {
      return { help: true };
    } else if (arg?.startsWith("--")) {
      throw new Error(`unknown option: ${arg}`);
    } else if (arg !== undefined) {
      files.push(arg);
    }
  }

  return { asOf, files, format };
}

function parseGradeArgs(
  argv: string[]
): { help: true } | { id: string; grade: number; asOf: Date; files: string[] } {
  let asOf = new Date();
  const files: string[] = [];
  let id: string | undefined;
  let grade: number | undefined;

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
    } else if (id === undefined) {
      id = arg;
    } else if (grade === undefined) {
      if (arg === undefined || !/^[0-5]$/.test(arg)) {
        throw new Error(`SCORE must be an integer from 0 to 5, got "${arg}"`);
      }
      grade = Number(arg);
    } else if (arg !== undefined) {
      files.push(arg);
    }
  }

  if (id === undefined) {
    throw new Error("grade requires a CARD_ID argument");
  }
  if (grade === undefined) {
    throw new Error("grade requires a SCORE argument (0-5)");
  }

  return { id, grade, asOf, files };
}

function runGrade(argv: string[]): number {
  let parsed: ReturnType<typeof parseGradeArgs>;
  try {
    parsed = parseGradeArgs(argv);
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }

  if ("help" in parsed) {
    console.log(gradeUsage());
    return 0;
  }
  const { id, grade, asOf, files } = parsed;

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

  const matches = cards.filter((c) => c.id === id);
  if (matches.length === 0) {
    console.error(`no card with id "${id}" found in input`);
    return 1;
  }
  if (matches.length > 1) {
    console.error(`multiple cards with id "${id}" found in input; refusing to guess which one to grade`);
    return 1;
  }
  const [card] = matches;

  let updated;
  try {
    updated = applyGrade(card, grade, asOf);
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }

  console.log(JSON.stringify(updated));
  return 0;
}

function main(argv: string[]): number {
  if (argv[0] === "grade") {
    return runGrade(argv.slice(1));
  }

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
  const { asOf, files, format } = parsed;

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
    if (format === "json") {
      console.log(JSON.stringify({ cards: [], due_count: 0, total_count: 0 }));
    } else {
      console.log("no cards given");
    }
    return 0;
  }

  const evaluated = sortByUrgency(evaluate(cards, asOf));
  const due = evaluated.filter((d) => d.daysOverdue >= 0);
  const upcoming = evaluated.filter((d) => d.daysOverdue < 0);

  if (format === "json") {
    console.log(
      JSON.stringify({
        cards: evaluated.map((d) => ({
          id: d.card.id,
          due_date: d.dueDate.toISOString().slice(0, 10),
          days_overdue: d.daysOverdue,
          status: statusOf(d.daysOverdue),
        })),
        due_count: due.length,
        total_count: cards.length,
      })
    );
    return 0;
  }

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
