import { describe, expect, it } from 'vitest';
import { cards } from '../cards';
import { handValue, isAcePair, isNaturalBlackjack, isPair, upcardValue } from './hand';

describe('handValue — hard totals', () => {
  it('sums plain number cards', () => {
    expect(handValue(cards('5H', '7D'))).toMatchObject({ total: 12, soft: false, busted: false });
  });

  it('counts face cards as ten', () => {
    expect(handValue(cards('KS', 'QH')).total).toBe(20);
    expect(handValue(cards('JC', '10D')).total).toBe(20);
  });

  it('reports a bust', () => {
    const value = handValue(cards('KS', 'QH', '5C'));
    expect(value.total).toBe(25);
    expect(value.busted).toBe(true);
  });
});

describe('handValue — aces', () => {
  it('counts a lone ace as 11 when it fits', () => {
    expect(handValue(cards('AS', '6D'))).toMatchObject({ total: 17, soft: true, hardTotal: 7 });
  });

  it('drops the ace to 1 when 11 would bust', () => {
    expect(handValue(cards('AS', '6D', '10C'))).toMatchObject({ total: 17, soft: false });
  });

  it('counts only one ace as 11', () => {
    expect(handValue(cards('AS', 'AD'))).toMatchObject({ total: 12, soft: true });
    expect(handValue(cards('AS', 'AD', 'AC'))).toMatchObject({ total: 13, soft: true });
    expect(handValue(cards('AS', 'AD', 'AC', 'AH'))).toMatchObject({ total: 14, soft: true });
  });

  it('handles four aces plus a ten', () => {
    expect(handValue(cards('AS', 'AD', 'AC', 'AH', '10S'))).toMatchObject({
      total: 14,
      soft: false,
    });
  });

  it('softens progressively as more cards arrive', () => {
    expect(handValue(cards('AS', '2D'))).toMatchObject({ total: 13, soft: true });
    expect(handValue(cards('AS', '2D', '9C'))).toMatchObject({ total: 12, soft: false });
    expect(handValue(cards('AS', '2D', '9C', '8H'))).toMatchObject({ total: 20, soft: false });
  });

  it('treats A,10 as 21', () => {
    expect(handValue(cards('AS', '10D'))).toMatchObject({ total: 21, soft: true });
  });

  it('reports the hard total alongside the soft one', () => {
    expect(handValue(cards('AS', '7D')).hardTotal).toBe(8);
  });

  it('values an empty hand as zero', () => {
    expect(handValue([])).toMatchObject({ total: 0, soft: false, busted: false });
  });
});

describe('natural blackjack detection', () => {
  it('accepts ace plus a ten-value card', () => {
    expect(isNaturalBlackjack(cards('AS', 'KD'))).toBe(true);
    expect(isNaturalBlackjack(cards('10S', 'AD'))).toBe(true);
  });

  it('rejects a three-card 21', () => {
    expect(isNaturalBlackjack(cards('7S', '7D', '7C'))).toBe(false);
  });

  it('rejects a two-card non-21', () => {
    expect(isNaturalBlackjack(cards('AS', '9D'))).toBe(false);
  });
});

describe('pair detection', () => {
  it('matches equal ranks', () => {
    expect(isPair(cards('8S', '8D'))).toBe(true);
  });

  it('matches any two ten-value cards', () => {
    expect(isPair(cards('KS', '10D'))).toBe(true);
    expect(isPair(cards('JS', 'QD'))).toBe(true);
  });

  it('rejects unequal values', () => {
    expect(isPair(cards('9S', '10D'))).toBe(false);
  });

  it('identifies ace pairs specifically', () => {
    expect(isAcePair(cards('AS', 'AD'))).toBe(true);
    expect(isAcePair(cards('AS', 'KD'))).toBe(false);
  });
});

describe('upcardValue', () => {
  it('maps aces to 11 and faces to 10', () => {
    expect(upcardValue(cards('AS')[0]!)).toBe(11);
    expect(upcardValue(cards('QS')[0]!)).toBe(10);
    expect(upcardValue(cards('7S')[0]!)).toBe(7);
  });
});
