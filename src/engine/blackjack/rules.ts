/**
 * Configurable blackjack rule set. Defaults model a standard 6-deck shoe game.
 */

export interface BlackjackRules {
  /** Number of 52-card decks in the shoe. */
  deckCount: number;
  /** Fraction of the shoe dealt before the cut card triggers a reshuffle. */
  penetration: number;
  /** false = dealer stands on all 17s (S17). true = dealer hits soft 17 (H17). */
  dealerHitsSoft17: boolean;
  /** Payout multiple for a natural blackjack. 1.5 = 3:2, 1.2 = 6:5. */
  blackjackPayout: number;
  /** Allow doubling on any two cards. When false, only the totals in doubleTotals. */
  doubleOnAnyTwo: boolean;
  /** Totals eligible to double when doubleOnAnyTwo is false (e.g. [9, 10, 11]). */
  doubleTotals: number[];
  doubleAfterSplit: boolean;
  /** Maximum number of player hands after splitting (4 = up to 3 splits). */
  maxSplitHands: number;
  /** Split aces receive exactly one card each and cannot be hit further. */
  splitAcesOneCardOnly: boolean;
  /** Allow re-splitting aces (rare; off by default). */
  resplitAces: boolean;
  /** Late surrender available on the first two cards. */
  surrenderAllowed: boolean;
  /** Insurance offered when the dealer shows an ace. */
  insuranceAllowed: boolean;
  /** Insurance pays 2:1. */
  insurancePayout: number;
  /** Dealer peeks for blackjack with a ten or ace up (US style). */
  dealerPeeks: boolean;
  minBet: number;
  maxBet: number;
  startingBankroll: number;
}

export const DEFAULT_RULES: BlackjackRules = {
  deckCount: 6,
  penetration: 0.75,
  dealerHitsSoft17: false,
  blackjackPayout: 1.5,
  doubleOnAnyTwo: true,
  doubleTotals: [9, 10, 11],
  doubleAfterSplit: true,
  maxSplitHands: 4,
  splitAcesOneCardOnly: true,
  resplitAces: false,
  surrenderAllowed: false,
  insuranceAllowed: true,
  insurancePayout: 2,
  dealerPeeks: true,
  minBet: 5,
  maxBet: 500,
  startingBankroll: 1000,
};

export function makeRules(overrides: Partial<BlackjackRules> = {}): BlackjackRules {
  return { ...DEFAULT_RULES, ...overrides };
}

/** Human-readable summary used on the settings/help screens. */
export function describeRules(rules: BlackjackRules): string[] {
  const payout =
    rules.blackjackPayout === 1.5
      ? 'Blackjack pays 3:2'
      : rules.blackjackPayout === 1.2
        ? 'Blackjack pays 6:5'
        : `Blackjack pays ${rules.blackjackPayout}:1`;

  return [
    `${rules.deckCount} deck${rules.deckCount === 1 ? '' : 's'}`,
    rules.dealerHitsSoft17 ? 'Dealer hits soft 17' : 'Dealer stands on soft 17',
    payout,
    rules.doubleOnAnyTwo
      ? 'Double on any two cards'
      : `Double on ${rules.doubleTotals.join('/')} only`,
    rules.doubleAfterSplit ? 'Double after split allowed' : 'No double after split',
    `Split up to ${rules.maxSplitHands} hands`,
    rules.splitAcesOneCardOnly ? 'Split aces get one card' : 'Split aces may be hit',
    rules.surrenderAllowed ? 'Late surrender offered' : 'No surrender',
    rules.insuranceAllowed ? 'Insurance offered on dealer ace' : 'No insurance',
  ];
}
