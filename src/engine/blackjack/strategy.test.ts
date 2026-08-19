import { describe, expect, it } from 'vitest';
import { cards } from '../cards';
import { makeRules } from './rules';
import {
  ALL_ACTIONS_AVAILABLE,
  actionLabel,
  getStrategyAdvice,
  insuranceAdvice,
  lookupStrategy,
  type ActionAvailability,
  type PlayerAction,
} from './strategy';

const S17 = makeRules();
const H17 = makeRules({ dealerHitsSoft17: true });
const SURRENDER = makeRules({ surrenderAllowed: true });
const NO_DAS = makeRules({ doubleAfterSplit: false });

const upcard = (notation: string) => cards(notation)[0]!;

function advise(
  hand: string[],
  dealer: string,
  rules = S17,
  available: Partial<ActionAvailability> = {},
): PlayerAction {
  return getStrategyAdvice(cards(...hand), upcard(dealer), rules, {
    ...ALL_ACTIONS_AVAILABLE,
    ...available,
  }).action;
}

describe('hard totals', () => {
  it('16 vs 10 hits (the classic)', () => {
    expect(advise(['10S', '6D'], '10H')).toBe('hit');
  });

  it('16 vs 10 surrenders when surrender is on', () => {
    expect(advise(['10S', '6D'], '10H', SURRENDER)).toBe('surrender');
  });

  it('16 vs 6 stands', () => {
    expect(advise(['10S', '6D'], '6H')).toBe('stand');
  });

  it('12 hits vs 2 and 3 but stands vs 4, 5 and 6', () => {
    expect(advise(['10S', '2D'], '2H')).toBe('hit');
    expect(advise(['10S', '2D'], '3H')).toBe('hit');
    expect(advise(['10S', '2D'], '4H')).toBe('stand');
    expect(advise(['10S', '2D'], '5H')).toBe('stand');
    expect(advise(['10S', '2D'], '6H')).toBe('stand');
    expect(advise(['10S', '2D'], '7H')).toBe('hit');
  });

  it('13-16 stand vs 2-6 and hit vs 7-A', () => {
    for (const hand of [['10S', '3D'], ['10S', '4D'], ['10S', '5D'], ['9S', '4D']]) {
      for (const up of ['2H', '3H', '4H', '5H', '6H']) {
        expect(advise(hand, up)).toBe('stand');
      }
      for (const up of ['7H', '8H']) {
        expect(advise(hand, up)).toBe('hit');
      }
    }
  });

  it('11 doubles against everything but an ace under S17', () => {
    for (const up of ['2H', '5H', '9H', '10H']) {
      expect(advise(['6S', '5D'], up)).toBe('double');
    }
    expect(advise(['6S', '5D'], 'AH')).toBe('hit');
  });

  it('11 doubles against an ace under H17', () => {
    expect(advise(['6S', '5D'], 'AH', H17)).toBe('double');
  });

  it('10 doubles vs 2-9 only', () => {
    expect(advise(['6S', '4D'], '9H')).toBe('double');
    expect(advise(['6S', '4D'], '10H')).toBe('hit');
    expect(advise(['6S', '4D'], 'AH')).toBe('hit');
  });

  it('9 doubles vs 3-6 only', () => {
    expect(advise(['5S', '4D'], '2H')).toBe('hit');
    expect(advise(['5S', '4D'], '3H')).toBe('double');
    expect(advise(['5S', '4D'], '6H')).toBe('double');
    expect(advise(['5S', '4D'], '7H')).toBe('hit');
  });

  it('always stands on hard 17+', () => {
    for (const up of ['2H', '6H', '10H', 'AH']) {
      expect(advise(['10S', '7D'], up)).toBe('stand');
      expect(advise(['10S', '9D'], up)).toBe('stand');
    }
  });

  it('always hits 8 or less', () => {
    for (const up of ['2H', '5H', '10H', 'AH']) {
      expect(advise(['3S', '4D'], up)).toBe('hit');
    }
  });
});

describe('soft totals', () => {
  it('A,7 stands vs 2 and 7 but hits vs 9', () => {
    expect(advise(['AS', '7D'], '2H')).toBe('stand');
    expect(advise(['AS', '7D'], '7H')).toBe('stand');
    expect(advise(['AS', '7D'], '9H')).toBe('hit');
  });

  it('A,7 doubles against a weak dealer', () => {
    for (const up of ['3H', '4H', '5H', '6H']) {
      expect(advise(['AS', '7D'], up)).toBe('double');
    }
  });

  it('A,7 vs 2 doubles under H17', () => {
    expect(advise(['AS', '7D'], '2H', H17)).toBe('double');
  });

  it('A,7 stands when doubling is unavailable', () => {
    expect(advise(['AS', '7D'], '5H', S17, { double: false })).toBe('stand');
  });

  it('A,2 and A,3 double only vs 5 and 6', () => {
    expect(advise(['AS', '2D'], '4H')).toBe('hit');
    expect(advise(['AS', '2D'], '5H')).toBe('double');
    expect(advise(['AS', '3D'], '6H')).toBe('double');
    expect(advise(['AS', '3D'], '7H')).toBe('hit');
  });

  it('A,4 and A,5 double vs 4-6', () => {
    expect(advise(['AS', '4D'], '3H')).toBe('hit');
    expect(advise(['AS', '4D'], '4H')).toBe('double');
    expect(advise(['AS', '5D'], '6H')).toBe('double');
  });

  it('A,6 doubles vs 3-6', () => {
    expect(advise(['AS', '6D'], '2H')).toBe('hit');
    expect(advise(['AS', '6D'], '3H')).toBe('double');
    expect(advise(['AS', '6D'], '6H')).toBe('double');
    expect(advise(['AS', '6D'], '7H')).toBe('hit');
  });

  it('A,8 stands everywhere under S17 but doubles vs 6 under H17', () => {
    expect(advise(['AS', '8D'], '6H')).toBe('stand');
    expect(advise(['AS', '8D'], '6H', H17)).toBe('double');
  });

  it('A,9 always stands', () => {
    for (const up of ['2H', '6H', '10H', 'AH']) {
      expect(advise(['AS', '9D'], up)).toBe('stand');
    }
  });

  it('falls back to hitting a soft double when the hand has three cards', () => {
    // A,2,2 = soft 15 vs 5: the book says double, but three cards can't double.
    expect(advise(['AS', '2D', '2C'], '5H', S17, { double: false })).toBe('hit');
  });
});

describe('pairs', () => {
  it('always splits aces', () => {
    for (const up of ['2H', '5H', '7H', '10H', 'AH']) {
      expect(advise(['AS', 'AD'], up)).toBe('split');
    }
  });

  it('always splits 8s', () => {
    for (const up of ['2H', '6H', '9H', '10H', 'AH']) {
      expect(advise(['8S', '8D'], up)).toBe('split');
    }
  });

  it('never splits tens', () => {
    for (const up of ['2H', '5H', '6H', '10H', 'AH']) {
      expect(advise(['10S', 'KD'], up)).toBe('stand');
      expect(advise(['QS', 'JD'], up)).toBe('stand');
    }
  });

  it('never splits 5s — plays them as a hard 10', () => {
    expect(advise(['5S', '5D'], '6H')).toBe('double');
    expect(advise(['5S', '5D'], '10H')).toBe('hit');
  });

  it('splits 9s except against 7, 10 and A', () => {
    for (const up of ['2H', '3H', '4H', '5H', '6H', '8H', '9H']) {
      expect(advise(['9S', '9D'], up)).toBe('split');
    }
    for (const up of ['7H', '10H', 'AH']) {
      expect(advise(['9S', '9D'], up)).toBe('stand');
    }
  });

  it('splits 7s vs 2-7 only', () => {
    expect(advise(['7S', '7D'], '7H')).toBe('split');
    expect(advise(['7S', '7D'], '8H')).toBe('hit');
  });

  it('splits 6s vs 2-6 with DAS, but not vs 2 without DAS', () => {
    expect(advise(['6S', '6D'], '2H')).toBe('split');
    expect(advise(['6S', '6D'], '2H', NO_DAS)).toBe('hit');
    expect(advise(['6S', '6D'], '5H', NO_DAS)).toBe('split');
    expect(advise(['6S', '6D'], '7H')).toBe('hit');
  });

  it('splits 4s only vs 5 and 6 with DAS', () => {
    expect(advise(['4S', '4D'], '4H')).toBe('hit');
    expect(advise(['4S', '4D'], '5H')).toBe('split');
    expect(advise(['4S', '4D'], '5H', NO_DAS)).toBe('hit');
  });

  it('splits 2s and 3s vs 2-7 with DAS', () => {
    expect(advise(['2S', '2D'], '2H')).toBe('split');
    expect(advise(['2S', '2D'], '2H', NO_DAS)).toBe('hit');
    expect(advise(['3S', '3D'], '7H')).toBe('split');
    expect(advise(['3S', '3D'], '8H')).toBe('hit');
  });
});

describe('legality-aware fallbacks', () => {
  it('never recommends splitting when the split cap is reached', () => {
    const advice = getStrategyAdvice(cards('8S', '8D'), upcard('10H'), S17, {
      ...ALL_ACTIONS_AVAILABLE,
      split: false,
    });
    expect(advice.action).toBe('hit'); // falls back to hard 16 vs 10
    expect(advice.idealAction).toBe('split');
    expect(advice.constrained).toBe(true);
  });

  it('falls back from a split of tens to standing on 20', () => {
    expect(advise(['10S', 'KD'], '6H', S17, { split: false })).toBe('stand');
  });

  it('falls back from splitting aces to hitting soft 12', () => {
    expect(advise(['AS', 'AD'], '6H', S17, { split: false })).toBe('hit');
  });

  it('never recommends doubling on three cards', () => {
    const advice = getStrategyAdvice(cards('5S', '3D', '3C'), upcard('5H'), S17, {
      ...ALL_ACTIONS_AVAILABLE,
      double: false,
    });
    expect(advice.action).toBe('hit');
    expect(advice.idealAction).toBe('double');
  });

  it('falls back from surrender to hitting when surrender is off', () => {
    const advice = getStrategyAdvice(cards('10S', '6D'), upcard('10H'), S17);
    expect(advice.action).toBe('hit');
    expect(advice.constrained).toBe(false);
  });

  it('marks the advice as unconstrained when the ideal play is legal', () => {
    const advice = getStrategyAdvice(cards('8S', '8D'), upcard('10H'), S17);
    expect(advice.action).toBe('split');
    expect(advice.constrained).toBe(false);
  });

  it('always produces a non-empty reason', () => {
    const hands = [
      ['AS', 'AD'],
      ['8S', '8D'],
      ['10S', '6D'],
      ['AS', '7D'],
      ['5S', '5D'],
      ['10S', '2D'],
      ['9S', '9D'],
      ['3S', '4D'],
    ];
    for (const hand of hands) {
      for (const up of ['2H', '6H', '9H', '10H', 'AH']) {
        const advice = getStrategyAdvice(cards(...hand), upcard(up), S17);
        expect(advice.reason.length).toBeGreaterThan(20);
        expect(actionLabel(advice.action)).toBeTruthy();
      }
    }
  });
});

describe('table lookups', () => {
  it('routes pairs to the pair table', () => {
    expect(lookupStrategy(cards('8S', '8D'), upcard('9H'), S17).table).toBe('pair');
  });

  it('routes soft hands to the soft table', () => {
    expect(lookupStrategy(cards('AS', '6D'), upcard('9H'), S17).table).toBe('soft');
  });

  it('routes everything else to the hard table', () => {
    const lookup = lookupStrategy(cards('10S', '6D'), upcard('9H'), S17);
    expect(lookup.table).toBe('hard');
    expect(lookup.row).toBe(16);
    expect(lookup.upcard).toBe(9);
  });

  it('treats a soft hand that has hardened as a hard hand', () => {
    expect(lookupStrategy(cards('AS', '6D', '10C'), upcard('9H'), S17).table).toBe('hard');
  });
});

describe('insurance', () => {
  it('always advises declining', () => {
    expect(insuranceAdvice().takeInsurance).toBe(false);
    expect(insuranceAdvice().reason).toMatch(/2:1/);
  });
});
