export interface Card {
  id: string;
  lastReview: Date;
  intervalDays: number;
  ease?: number;
  repetitions?: number;
}

// Input is one JSON object per line rather than a JSON array so that files
// from different export tools can be concatenated with plain `cat`.
export function parseCardLine(line: string, source: string, lineNumber: number): Card {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch (err) {
    throw new Error(`${source}:${lineNumber}: invalid JSON (${(err as Error).message})`);
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${source}:${lineNumber}: expected a JSON object`);
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.id !== "string" || obj.id.length === 0) {
    throw new Error(`${source}:${lineNumber}: missing or invalid "id"`);
  }

  if (typeof obj.last_review !== "string") {
    throw new Error(`${source}:${lineNumber}: missing or invalid "last_review"`);
  }
  const lastReview = new Date(obj.last_review);
  if (Number.isNaN(lastReview.getTime())) {
    throw new Error(`${source}:${lineNumber}: "last_review" is not a valid date`);
  }

  if (
    typeof obj.interval_days !== "number" ||
    !Number.isFinite(obj.interval_days) ||
    obj.interval_days < 0
  ) {
    throw new Error(`${source}:${lineNumber}: missing or invalid "interval_days"`);
  }

  const ease = typeof obj.ease === "number" ? obj.ease : undefined;

  if (
    obj.repetitions !== undefined &&
    (typeof obj.repetitions !== "number" ||
      !Number.isInteger(obj.repetitions) ||
      obj.repetitions < 0)
  ) {
    throw new Error(`${source}:${lineNumber}: "repetitions" must be a non-negative integer`);
  }
  const repetitions = typeof obj.repetitions === "number" ? obj.repetitions : undefined;

  return { id: obj.id, lastReview, intervalDays: obj.interval_days, ease, repetitions };
}
