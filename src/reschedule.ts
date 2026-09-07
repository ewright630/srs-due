import type { Card } from "./card.js";

// Default ease factor for a card that has never been graded, and the floor
// SM-2 never lets ease drop below regardless of how badly a card is failed.
export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;

export interface GradedCard {
  id: string;
  last_review: string;
  interval_days: number;
  ease: number;
  repetitions: number;
}

// Standard SM-2: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
// grade is 0-5, where 3 is the pass/fail boundary.
export function applyGrade(card: Card, grade: number, now: Date): GradedCard {
  if (!Number.isInteger(grade) || grade < 0 || grade > 5) {
    throw new Error(`grade must be an integer from 0 to 5, got ${grade}`);
  }

  const priorEase = card.ease ?? DEFAULT_EASE;
  const priorRepetitions = card.repetitions ?? 0;

  let repetitions: number;
  let intervalDays: number;

  if (grade < 3) {
    // A failed recall restarts the interval sequence, but does not reset
    // ease - ease tracks how hard the card has historically been, not
    // whether the most recent attempt succeeded.
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions = priorRepetitions + 1;
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(card.intervalDays * priorEase);
    }
  }

  const ease = Math.max(MIN_EASE, priorEase + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));

  return {
    id: card.id,
    last_review: now.toISOString(),
    interval_days: intervalDays,
    ease,
    repetitions,
  };
}
