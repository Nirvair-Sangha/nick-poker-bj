/**
 * Pure card primitives. No React, no DOM.
 */

export const SUITS = ['S', 'H', 'D', 'C'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
] as const;
export type Rank = (typeof RANKS)[number];

export interface Card {
  readonly rank: Rank;
  readonly suit: Suit;
  /** Stable id so React keys and re-shuffles don't collide. */
  readonly id: string;
}

export const SUIT_SYMBOL: Record<Suit, string> = {
  S: '\u2660',
  H: '\u2665',
  D: '\u2666',
  C: '\u2663',
};

export const SUIT_NAME: Record<Suit, string> = {
  S: 'Spades',
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs',
};

export function isRedSuit(suit: Suit): boolean {
  return suit === 'H' || suit === 'D';
}

/** Blackjack rank value; aces returned as 11 and softened later by the hand evaluator. */
export function rankValue(rank: Rank): number {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

export function isTenValue(rank: Rank): boolean {
  return rankValue(rank) === 10;
}

export function cardLabel(card: Card): string {
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
}

/** A single 52-card deck. `deckIndex` keeps ids unique inside a multi-deck shoe. */
export function createDeck(deckIndex = 0): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ rank, suit, id: `${deckIndex}-${rank}${suit}` });
    }
  }
  return cards;
}

export function createShoeCards(deckCount: number): Card[] {
  if (!Number.isInteger(deckCount) || deckCount < 1) {
    throw new Error(`deckCount must be a positive integer, received ${deckCount}`);
  }
  const cards: Card[] = [];
  for (let i = 0; i < deckCount; i += 1) {
    cards.push(...createDeck(i));
  }
  return cards;
}

/**
 * Random source abstraction. Defaults to crypto.getRandomValues so shuffles are
 * cryptographically seeded; tests can inject a deterministic generator.
 */
export type RandomInt = (maxExclusive: number) => number;

export function cryptoRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) throw new Error('maxExclusive must be > 0');
  if (maxExclusive === 1) return 0;

  const cryptoObj: Crypto | undefined =
    typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;

  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    // Deliberately loud: we never want a silent Math.random fallback in a card game.
    throw new Error('crypto.getRandomValues is unavailable; supply a RandomInt explicitly');
  }

  // Rejection sampling to avoid modulo bias.
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  let value = 0;
  do {
    cryptoObj.getRandomValues(buf);
    value = buf[0]!;
  } while (value >= limit);
  return value % maxExclusive;
}

/** Fisher-Yates. Returns a new array; the input is not mutated. */
export function shuffle<T>(items: readonly T[], randomInt: RandomInt = cryptoRandomInt): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

export interface Shoe {
  readonly cards: readonly Card[];
  /** Index of the next card to be dealt. */
  readonly position: number;
  readonly deckCount: number;
  /** Once position reaches this, the shoe is reshuffled at the end of the round. */
  readonly cutCardIndex: number;
}

export function createShoe(
  deckCount: number,
  penetration: number,
  randomInt: RandomInt = cryptoRandomInt,
): Shoe {
  const cards = shuffle(createShoeCards(deckCount), randomInt);
  const clamped = Math.min(Math.max(penetration, 0.1), 0.95);
  return {
    cards,
    position: 0,
    deckCount,
    cutCardIndex: Math.floor(cards.length * clamped),
  };
}

export function reshuffleShoe(shoe: Shoe, randomInt: RandomInt = cryptoRandomInt): Shoe {
  return { ...shoe, cards: shuffle(shoe.cards, randomInt), position: 0 };
}

export function cardsRemaining(shoe: Shoe): number {
  return shoe.cards.length - shoe.position;
}

export function needsShuffle(shoe: Shoe): boolean {
  return shoe.position >= shoe.cutCardIndex;
}

export interface DrawResult {
  readonly card: Card;
  readonly shoe: Shoe;
}

/**
 * Immutably draws one card. If the shoe runs dry mid-round we reshuffle rather
 * than throwing, so a round can always be completed.
 */
export function draw(shoe: Shoe, randomInt: RandomInt = cryptoRandomInt): DrawResult {
  const source = shoe.position >= shoe.cards.length ? reshuffleShoe(shoe, randomInt) : shoe;
  const card = source.cards[source.position]!;
  return { card, shoe: { ...source, position: source.position + 1 } };
}

/** Draws `count` cards in order. */
export function drawMany(
  shoe: Shoe,
  count: number,
  randomInt: RandomInt = cryptoRandomInt,
): { cards: Card[]; shoe: Shoe } {
  const cards: Card[] = [];
  let current = shoe;
  for (let i = 0; i < count; i += 1) {
    const result = draw(current, randomInt);
    cards.push(result.card);
    current = result.shoe;
  }
  return { cards, shoe: current };
}

/**
 * Builds a shoe whose next cards are exactly `cards`, in order. Test-only helper
 * that keeps deterministic scenarios out of the production shuffle path.
 */
export function createStackedShoe(cards: readonly Card[], deckCount = 1): Shoe {
  return {
    cards: cards.slice(),
    position: 0,
    deckCount,
    cutCardIndex: cards.length,
  };
}

/** Parses shorthand like 'AS', '10H', 'KD' into a Card. Useful for tests and fixtures. */
export function card(notation: string, idSuffix = ''): Card {
  const suit = notation.slice(-1).toUpperCase() as Suit;
  const rank = notation.slice(0, -1).toUpperCase() as Rank;
  if (!SUITS.includes(suit)) throw new Error(`Bad suit in "${notation}"`);
  if (!RANKS.includes(rank)) throw new Error(`Bad rank in "${notation}"`);
  return { rank, suit, id: `${rank}${suit}${idSuffix}` };
}

export function cards(...notations: string[]): Card[] {
  return notations.map((n, i) => card(n, `#${i}`));
}
