import { rankValue, type Card } from '../cards';
import { handValue, isAcePair, isPair, upcardValue } from './hand';
import type { BlackjackRules } from './rules';

export type PlayerAction = 'hit' | 'stand' | 'double' | 'split' | 'surrender';

/**
 * Raw table codes.
 *  H   hit
 *  S   stand
 *  D   double if allowed, otherwise hit
 *  Ds  double if allowed, otherwise stand
 *  P   split
 *  Ph  split if double-after-split is allowed, otherwise hit
 *  Rh  surrender if allowed, otherwise hit
 *  Rs  surrender if allowed, otherwise stand
 *  Rp  surrender if allowed, otherwise split
 */
export type StrategyCode = 'H' | 'S' | 'D' | 'Ds' | 'P' | 'Ph' | 'Rh' | 'Rs' | 'Rp';

/** Dealer upcards in table column order. 11 represents an ace. */
export const DEALER_UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

function columnFor(upcard: number): number {
  const index = DEALER_UPCARDS.indexOf(upcard as (typeof DEALER_UPCARDS)[number]);
  if (index === -1) throw new Error(`Invalid dealer upcard value: ${upcard}`);
  return index;
}

/* ------------------------------------------------------------------ *
 * Hard totals (no ace counted as 11), player total 5-21.
 * Baseline: multi-deck, dealer stands on soft 17, double after split.
 * ------------------------------------------------------------------ */
export const HARD_TOTALS: Readonly<Record<number, readonly StrategyCode[]>> = {
  //         2     3     4     5     6     7     8     9     10    A
  5: ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
  6: ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
  7: ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
  8: ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
  9: ['H', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'],
  10: ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H', 'H'],
  11: ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H'],
  12: ['H', 'H', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  13: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  14: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  15: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'Rh', 'H'],
  16: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'Rh', 'Rh', 'Rh'],
  17: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  18: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  19: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  20: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
  21: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
};

/* ------------------------------------------------------------------ *
 * Soft totals (hand contains an ace counted as 11), total 13-21.
 * ------------------------------------------------------------------ */
export const SOFT_TOTALS: Readonly<Record<number, readonly StrategyCode[]>> = {
  //          2     3     4     5     6     7     8     9     10    A
  12: ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'], // A,A when splitting is unavailable
  13: ['H', 'H', 'H', 'D', 'D', 'H', 'H', 'H', 'H', 'H'], // A,2
  14: ['H', 'H', 'H', 'D', 'D', 'H', 'H', 'H', 'H', 'H'], // A,3
  15: ['H', 'H', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'], // A,4
  16: ['H', 'H', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'], // A,5
  17: ['H', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'], // A,6
  18: ['S', 'Ds', 'Ds', 'Ds', 'Ds', 'S', 'S', 'H', 'H', 'H'], // A,7
  19: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'], // A,8
  20: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'], // A,9
  21: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'],
};

/* ------------------------------------------------------------------ *
 * Pairs, keyed by the blackjack value of one card (11 = aces).
 * ------------------------------------------------------------------ */
export const PAIRS: Readonly<Record<number, readonly StrategyCode[]>> = {
  //          2     3     4     5     6     7     8     9     10    A
  11: ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'], // A,A
  10: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'], // 10,10
  9: ['P', 'P', 'P', 'P', 'P', 'S', 'P', 'P', 'S', 'S'],
  8: ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  7: ['P', 'P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  6: ['Ph', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H', 'H'],
  5: ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H', 'H'], // never split
  4: ['H', 'H', 'H', 'Ph', 'Ph', 'H', 'H', 'H', 'H', 'H'],
  3: ['Ph', 'Ph', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  2: ['Ph', 'Ph', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
};

/**
 * Dealer-hits-soft-17 deviations from the S17 baseline above.
 * Applied on lookup so both rule sets stay correct from one source of truth.
 */
function applyH17(
  code: StrategyCode,
  kind: 'hard' | 'soft' | 'pair',
  total: number,
  upcard: number,
): StrategyCode {
  if (kind === 'hard') {
    if (total === 11 && upcard === 11) return 'D';
    if (total === 17 && upcard === 11) return 'Rs';
    if (total === 15 && upcard === 11) return 'Rh';
  }
  if (kind === 'soft') {
    if (total === 18 && upcard === 2) return 'Ds';
    if (total === 19 && upcard === 6) return 'Ds';
  }
  if (kind === 'pair') {
    if (total === 8 && upcard === 11) return 'Rp';
  }
  return code;
}

export interface StrategyLookup {
  code: StrategyCode;
  /** Which table produced the code. */
  table: 'hard' | 'soft' | 'pair';
  /** Row key: the player total, or the pair's card value. */
  row: number;
  upcard: number;
}

/** Raw table lookup, before any legality filtering. */
export function lookupStrategy(
  playerCards: readonly Card[],
  dealerUpcard: Card,
  rules: BlackjackRules,
  options: { canSplit?: boolean } = {},
): StrategyLookup {
  const upcard = upcardValue(dealerUpcard);
  const column = columnFor(upcard);
  const value = handValue(playerCards);
  const splitEligible = options.canSplit !== false && isPair(playerCards);

  if (splitEligible) {
    const pairValue = rankValue(playerCards[0]!.rank);
    const row = PAIRS[pairValue];
    if (row) {
      const code = rules.dealerHitsSoft17
        ? applyH17(row[column]!, 'pair', pairValue, upcard)
        : row[column]!;
      return { code, table: 'pair', row: pairValue, upcard };
    }
  }

  if (value.soft) {
    const row = SOFT_TOTALS[value.total];
    if (row) {
      const code = rules.dealerHitsSoft17
        ? applyH17(row[column]!, 'soft', value.total, upcard)
        : row[column]!;
      return { code, table: 'soft', row: value.total, upcard };
    }
  }

  const clamped = Math.min(Math.max(value.total, 5), 21);
  const row = HARD_TOTALS[clamped]!;
  const code = rules.dealerHitsSoft17
    ? applyH17(row[column]!, 'hard', clamped, upcard)
    : row[column]!;
  return { code, table: 'hard', row: clamped, upcard };
}

/** Which actions the coach is allowed to recommend right now. */
export interface ActionAvailability {
  hit: boolean;
  stand: boolean;
  double: boolean;
  split: boolean;
  surrender: boolean;
}

export const ALL_ACTIONS_AVAILABLE: ActionAvailability = {
  hit: true,
  stand: true,
  double: true,
  split: true,
  surrender: true,
};

export interface StrategyAdvice {
  action: PlayerAction;
  /** The action the table would pick with no restrictions. */
  idealAction: PlayerAction;
  /** True when the ideal play was illegal here and we fell back. */
  constrained: boolean;
  reason: string;
  lookup: StrategyLookup;
}

function idealActionFor(code: StrategyCode): PlayerAction {
  switch (code) {
    case 'H':
      return 'hit';
    case 'S':
      return 'stand';
    case 'D':
    case 'Ds':
      return 'double';
    case 'P':
    case 'Ph':
      return 'split';
    case 'Rh':
    case 'Rs':
    case 'Rp':
      return 'surrender';
    default:
      return 'hit';
  }
}

/** The raw book play for a spot, ignoring both rules and current legality. */
export function bookAction(
  playerCards: readonly Card[],
  dealerUpcard: Card,
  rules: BlackjackRules,
): PlayerAction {
  return idealActionFor(lookupStrategy(playerCards, dealerUpcard, rules).code);
}

/**
 * Resolves a table code against what is actually legal, so we never recommend
 * an illegal move. Falls through to the correct next-best action.
 */
function resolveCode(
  code: StrategyCode,
  available: ActionAvailability,
  playerCards: readonly Card[],
  dealerUpcard: Card,
  rules: BlackjackRules,
): PlayerAction {
  // Surrender is only ever legal if the rule set offers it at all.
  const canSurrender = available.surrender && rules.surrenderAllowed;

  switch (code) {
    case 'H':
      return available.hit ? 'hit' : 'stand';
    case 'S':
      return available.stand ? 'stand' : 'hit';
    case 'D':
      return available.double ? 'double' : available.hit ? 'hit' : 'stand';
    case 'Ds':
      return available.double ? 'double' : available.stand ? 'stand' : 'hit';
    case 'P':
      if (available.split) return 'split';
      return fallbackWithoutSplit(playerCards, dealerUpcard, rules, available);
    case 'Ph':
      if (available.split && rules.doubleAfterSplit) return 'split';
      if (available.split && !rules.doubleAfterSplit) {
        return available.hit ? 'hit' : 'stand';
      }
      return fallbackWithoutSplit(playerCards, dealerUpcard, rules, available);
    case 'Rh':
      if (canSurrender) return 'surrender';
      return available.hit ? 'hit' : 'stand';
    case 'Rs':
      if (canSurrender) return 'surrender';
      return available.stand ? 'stand' : 'hit';
    case 'Rp':
      if (canSurrender) return 'surrender';
      if (available.split) return 'split';
      return fallbackWithoutSplit(playerCards, dealerUpcard, rules, available);
    default:
      return 'hit';
  }
}

/** Re-runs the lookup with splits disabled, so a pair falls back to hard/soft play. */
function fallbackWithoutSplit(
  playerCards: readonly Card[],
  dealerUpcard: Card,
  rules: BlackjackRules,
  available: ActionAvailability,
): PlayerAction {
  // A,A with no split available is a soft 12: always hit.
  if (isAcePair(playerCards)) return available.hit ? 'hit' : 'stand';
  const lookup = lookupStrategy(playerCards, dealerUpcard, rules, { canSplit: false });
  return resolveCode(lookup.code, { ...available, split: false }, playerCards, dealerUpcard, rules);
}

const ACTION_LABEL: Record<PlayerAction, string> = {
  hit: 'Hit',
  stand: 'Stand',
  double: 'Double',
  split: 'Split',
  surrender: 'Surrender',
};

export function actionLabel(action: PlayerAction): string {
  return ACTION_LABEL[action];
}

function upcardLabel(upcard: number): string {
  return upcard === 11 ? 'A' : String(upcard);
}

/** Plain-English justification. Specific text for the well-known spots, templates otherwise. */
function explain(
  action: PlayerAction,
  lookup: StrategyLookup,
  playerCards: readonly Card[],
  constrained: boolean,
  idealAction: PlayerAction,
): string {
  const up = upcardLabel(lookup.upcard);
  const dealerWeak = lookup.upcard >= 4 && lookup.upcard <= 6;
  const dealerStrong = lookup.upcard >= 9 || lookup.upcard === 11;
  const value = handValue(playerCards);

  if (constrained) {
    return `Basic strategy says ${ACTION_LABEL[idealAction].toLowerCase()} here, but that isn't available on this hand — ${ACTION_LABEL[action].toLowerCase()} is the best legal alternative.`;
  }

  if (lookup.table === 'pair') {
    const pv = lookup.row;
    if (pv === 11) {
      return 'Always split aces. Two hands starting with an ace are worth far more than a single soft 12.';
    }
    if (pv === 10 && action === 'stand') {
      return "Never split tens. 20 is already a winning hand — don't break it up chasing two mediocre ones.";
    }
    if (pv === 8 && action === 'split') {
      return `Always split 8s. Hard 16 is the worst hand in blackjack; two hands starting with 8 are much better, even against a ${up}.`;
    }
    if (pv === 9 && action === 'stand') {
      return `18 is good enough against a ${up}. Splitting here risks turning one strong hand into two weaker ones.`;
    }
    if (pv === 9 && action === 'split') {
      return `Split 9s against a ${up}. Two hands starting with 9 beat standing on 18 when the dealer is this vulnerable.`;
    }
    if (pv === 5) {
      return action === 'double'
        ? `Never split 5s — play them as a hard 10 and double against the dealer's ${up}.`
        : `Never split 5s. Play the hand as a hard 10 against a ${up}.`;
    }
    if (pv === 4 && action === 'hit') {
      return `A pair of 4s is a hard 8 — just hit. Splitting only pays off against a dealer 5 or 6 with double-after-split.`;
    }
    if (action === 'split') {
      return `Split ${pv}s against a ${up}. The dealer is likely to bust, so getting more money on the table is worth it.`;
    }
    if (action === 'hit') {
      return `Don't split ${pv}s against a ${up} — the dealer is too strong. Play it as a single ${value.total} and hit.`;
    }
  }

  if (lookup.table === 'soft') {
    const kicker = lookup.row - 11;
    const name = `A/${kicker}`;
    if (lookup.row === 18) {
      if (action === 'double') {
        return `${name} against a ${up}: the dealer is weak, so double. You can't bust, and 18 alone often isn't enough to win.`;
      }
      if (action === 'stand') {
        return `${name} against a ${up}: 18 is already ahead of the dealer's likely total — take the money and stand.`;
      }
      if (action === 'hit') {
        return `${name} against a ${up}: soft 18 loses to the dealer's 19+ far too often. Hitting can only improve it — you can't bust.`;
      }
    }
    if (action === 'double') {
      return `Soft ${lookup.row} (${name}) against a ${up}: the dealer is likely to bust, and you can't bust by taking one card. Double.`;
    }
    if (action === 'stand') {
      return `Soft ${lookup.row} is strong enough to stand against a ${up}.`;
    }
    return `Soft ${lookup.row} (${name}) against a ${up}: too weak to stand, and you can't bust by hitting. Take a card.`;
  }

  // Hard totals
  if (action === 'surrender') {
    return `Hard ${lookup.row} against a ${up} is a losing hand more often than not. Giving up half the bet loses less money over time than playing it out.`;
  }
  if (lookup.row === 16 && lookup.upcard === 10 && action === 'hit') {
    return "16 vs dealer 10: you're losing either way, but hitting loses less often than standing. Take the card.";
  }
  if (lookup.row === 12 && (lookup.upcard === 2 || lookup.upcard === 3) && action === 'hit') {
    return `12 against a ${up}: the dealer only busts about a quarter of the time with a low card showing, so hitting is the smaller risk. Only one card in thirteen busts you.`;
  }
  if (lookup.row === 12 && dealerWeak && action === 'stand') {
    return `12 against a ${up}: the dealer busts often enough with a ${up} showing that standing and letting them draw is better than risking a bust yourself.`;
  }
  if (action === 'double') {
    return `Hard ${lookup.row} against a ${up}: you're a favourite on this hand, so get more money out while the dealer is showing a ${up}.`;
  }
  if (action === 'stand') {
    return dealerWeak
      ? `Hard ${lookup.row} against a ${up}: don't risk busting — the dealer has to draw to a weak card and will bust often.`
      : `Hard ${lookup.row} against a ${up}: standing is the best of a bad set of options. Hitting busts too often.`;
  }
  if (lookup.row >= 12) {
    return `Hard ${lookup.row} against a ${up}: the dealer is ${dealerStrong ? 'strong' : 'solid'} with a ${up} showing and will likely make 17+. You have to improve — hit.`;
  }
  return `Hard ${lookup.row} can't bust with one card. Always take a free card here.`;
}

/**
 * The full coach recommendation for the current spot, guaranteed to be a legal action.
 */
export function getStrategyAdvice(
  playerCards: readonly Card[],
  dealerUpcard: Card,
  rules: BlackjackRules,
  available: ActionAvailability = ALL_ACTIONS_AVAILABLE,
): StrategyAdvice {
  const lookup = lookupStrategy(playerCards, dealerUpcard, rules, { canSplit: available.split });
  // What the book says for this rule set with every action still on the table.
  const unrestricted = lookupStrategy(playerCards, dealerUpcard, rules);
  const idealAction = resolveCode(
    unrestricted.code,
    ALL_ACTIONS_AVAILABLE,
    playerCards,
    dealerUpcard,
    rules,
  );
  const action = resolveCode(lookup.code, available, playerCards, dealerUpcard, rules);
  const constrained = action !== idealAction;
  return {
    action,
    idealAction,
    constrained,
    reason: explain(action, lookup, playerCards, constrained, idealAction),
    lookup,
  };
}

/**
 * Insurance is always a bad bet without card counting: the dealer completes a
 * blackjack less than a third of the time but insurance only pays 2:1.
 */
export function insuranceAdvice(): { takeInsurance: boolean; reason: string } {
  return {
    takeInsurance: false,
    reason:
      'Decline. Insurance pays 2:1 but the dealer only has blackjack about 31% of the time, so it loses money on every bet unless you are counting cards.',
  };
}
