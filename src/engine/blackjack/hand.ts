import { rankValue, type Card } from '../cards';

export interface HandValue {
  /** Best total <= 21 when possible, otherwise the minimum (busted) total. */
  total: number;
  /** True when an ace is still being counted as 11. */
  soft: boolean;
  busted: boolean;
  /** Total with every ace counted as 1. */
  hardTotal: number;
}

/**
 * Aces count as 11 until that would bust, then drop to 1. Because only one ace
 * can ever be 11 without busting, we add 10 back at most once.
 */
export function handValue(cards: readonly Card[]): HandValue {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    const value = rankValue(card.rank);
    if (card.rank === 'A') aces += 1;
    total += value === 11 ? 1 : value;
  }

  const hardTotal = total;
  let soft = false;
  if (aces > 0 && total + 10 <= 21) {
    total += 10;
    soft = true;
  }

  return { total, soft, busted: total > 21, hardTotal };
}

export function handTotal(cards: readonly Card[]): number {
  return handValue(cards).total;
}

export function isBusted(cards: readonly Card[]): boolean {
  return handValue(cards).busted;
}

/** A natural: exactly two cards totalling 21. Split hands are never naturals. */
export function isNaturalBlackjack(cards: readonly Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

/** Two cards of equal blackjack value (so K+10 counts as a pair of tens). */
export function isPair(cards: readonly Card[]): boolean {
  if (cards.length !== 2) return false;
  return rankValue(cards[0]!.rank) === rankValue(cards[1]!.rank);
}

export function isAcePair(cards: readonly Card[]): boolean {
  return cards.length === 2 && cards[0]!.rank === 'A' && cards[1]!.rank === 'A';
}

/** Dealer upcard value used to index the strategy tables: 2-10 or 11 for an ace. */
export function upcardValue(card: Card): number {
  return rankValue(card.rank);
}

export function formatTotal(value: HandValue): string {
  if (value.busted) return `${value.total} — bust`;
  if (value.soft) return `${value.total}`;
  return `${value.total}`;
}
