import { describe, expect, it } from 'vitest';
import {
  cards,
  createShoeCards,
  createStackedShoe,
  cryptoRandomInt,
  draw,
  needsShuffle,
  shuffle,
} from './cards';

describe('deck construction', () => {
  it('builds 52 unique cards per deck', () => {
    const deck = createShoeCards(1);
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => `${c.rank}${c.suit}`)).size).toBe(52);
  });

  it('builds a 6-deck shoe with unique ids', () => {
    const shoe = createShoeCards(6);
    expect(shoe).toHaveLength(312);
    expect(new Set(shoe.map((c) => c.id)).size).toBe(312);
  });

  it('rejects invalid deck counts', () => {
    expect(() => createShoeCards(0)).toThrow();
    expect(() => createShoeCards(1.5)).toThrow();
  });
});

describe('shuffle', () => {
  it('is a permutation and does not mutate the input', () => {
    const original = createShoeCards(1);
    const snapshot = original.slice();
    const shuffled = shuffle(original, (max) => max - 1);
    expect(original).toEqual(snapshot);
    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled.map((c) => c.id))).toEqual(new Set(original.map((c) => c.id)));
  });

  it('actually reorders with a real random source', () => {
    const original = createShoeCards(2);
    const shuffled = shuffle(original);
    const samePositions = shuffled.filter((c, i) => c.id === original[i]!.id).length;
    expect(samePositions).toBeLessThan(original.length / 2);
  });
});

describe('cryptoRandomInt', () => {
  it('stays within range', () => {
    for (let i = 0; i < 200; i += 1) {
      const n = cryptoRandomInt(10);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(10);
    }
  });

  it('always returns 0 for a range of one', () => {
    expect(cryptoRandomInt(1)).toBe(0);
  });
});

describe('shoe draw', () => {
  it('deals cards in order without mutating the source shoe', () => {
    const shoe = createStackedShoe(cards('AS', 'KD', '5C'));
    const first = draw(shoe);
    expect(first.card.rank).toBe('A');
    expect(shoe.position).toBe(0);
    const second = draw(first.shoe);
    expect(second.card.rank).toBe('K');
  });

  it('reshuffles instead of running out', () => {
    const shoe = createStackedShoe(cards('AS', 'KD'));
    const a = draw(shoe);
    const b = draw(a.shoe);
    const c = draw(b.shoe);
    expect(c.card).toBeDefined();
    expect(c.shoe.position).toBe(1);
  });

  it('flags a reshuffle once the cut card is passed', () => {
    const shoe = { ...createStackedShoe(cards('AS', 'KD', '5C', '7H')), cutCardIndex: 2 };
    expect(needsShuffle(shoe)).toBe(false);
    expect(needsShuffle({ ...shoe, position: 2 })).toBe(true);
  });
});
