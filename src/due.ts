import type { Card } from "./card.js";

export interface DueCard {
  card: Card;
  dueDate: Date;
  // Positive: days overdue. Zero: due today. Negative: days until due.
  daysOverdue: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function dueDateOf(card: Card): Date {
  return new Date(card.lastReview.getTime() + card.intervalDays * MS_PER_DAY);
}

export function evaluate(cards: Card[], asOf: Date): DueCard[] {
  return cards.map((card) => {
    const dueDate = dueDateOf(card);
    // Floor rather than round: a card due at 09:00 and checked at 08:59 the
    // next day should read as "1 day overdue", not "0" from rounding down.
    const daysOverdue = Math.floor((asOf.getTime() - dueDate.getTime()) / MS_PER_DAY);
    return { card, dueDate, daysOverdue };
  });
}

// Most overdue first, then soonest-upcoming first, since both fall out of a
// single descending sort on daysOverdue.
export function sortByUrgency(dueCards: DueCard[]): DueCard[] {
  return [...dueCards].sort((a, b) => b.daysOverdue - a.daysOverdue);
}
