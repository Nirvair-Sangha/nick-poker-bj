import {
  createShoe,
  draw,
  needsShuffle,
  rankValue,
  reshuffleShoe,
  cryptoRandomInt,
  type Card,
  type RandomInt,
  type Shoe,
} from '../cards';
import { handValue, isAcePair, isNaturalBlackjack, isPair, type HandValue } from './hand';
import { DEFAULT_RULES, type BlackjackRules } from './rules';
import type { PlayerAction } from './strategy';

export type Phase = 'betting' | 'insurance' | 'playerTurn' | 'dealerTurn' | 'settled';

export type HandOutcome =
  | 'blackjack'
  | 'win'
  | 'push'
  | 'lose'
  | 'bust'
  | 'surrender'
  | 'dealerBlackjack';

export interface PlayerHand {
  readonly id: string;
  readonly cards: readonly Card[];
  readonly bet: number;
  readonly doubled: boolean;
  readonly surrendered: boolean;
  /** This hand was produced by a split. */
  readonly fromSplit: boolean;
  /** This hand was produced by splitting aces. */
  readonly fromSplitAces: boolean;
  /** Player can take no more actions on this hand. */
  readonly done: boolean;
  readonly outcome: HandOutcome | null;
  /** Chips returned to the bankroll at settlement (stake + winnings). */
  readonly returned: number;
  /** Profit or loss for this hand. */
  readonly net: number;
}

export interface DealerHand {
  readonly cards: readonly Card[];
  /** The second card is face down until the dealer's turn. */
  readonly holeCardHidden: boolean;
}

export interface RoundSummary {
  readonly net: number;
  readonly wagered: number;
  readonly outcomes: readonly HandOutcome[];
  readonly insuranceNet: number;
}

export interface GameState {
  readonly rules: BlackjackRules;
  readonly shoe: Shoe;
  readonly bankroll: number;
  readonly phase: Phase;
  readonly hands: readonly PlayerHand[];
  readonly activeHandIndex: number;
  readonly dealer: DealerHand;
  readonly insuranceBet: number;
  readonly insuranceOffered: boolean;
  readonly insuranceResolved: boolean;
  readonly insuranceNet: number;
  readonly lastBet: number;
  readonly roundNumber: number;
  readonly summary: RoundSummary | null;
  readonly message: string;
  /** Set when the shoe passed the cut card; consumed at the start of the next deal. */
  readonly shufflePending: boolean;
}

export interface EngineOptions {
  rules?: Partial<BlackjackRules>;
  bankroll?: number;
  randomInt?: RandomInt;
  /** Injected for deterministic tests. */
  shoe?: Shoe;
}

let handIdCounter = 0;
function nextHandId(): string {
  handIdCounter += 1;
  return `h${handIdCounter}`;
}

function emptyHand(bet: number, cards: readonly Card[], overrides: Partial<PlayerHand> = {}): PlayerHand {
  return {
    id: nextHandId(),
    cards,
    bet,
    doubled: false,
    surrendered: false,
    fromSplit: false,
    fromSplitAces: false,
    done: false,
    outcome: null,
    returned: 0,
    net: 0,
    ...overrides,
  };
}

export function createGame(options: EngineOptions = {}): GameState {
  const rules: BlackjackRules = { ...DEFAULT_RULES, ...options.rules };
  const randomInt = options.randomInt ?? cryptoRandomInt;
  const shoe = options.shoe ?? createShoe(rules.deckCount, rules.penetration, randomInt);
  return {
    rules,
    shoe,
    bankroll: options.bankroll ?? rules.startingBankroll,
    phase: 'betting',
    hands: [],
    activeHandIndex: 0,
    dealer: { cards: [], holeCardHidden: true },
    insuranceBet: 0,
    insuranceOffered: false,
    insuranceResolved: false,
    insuranceNet: 0,
    lastBet: Math.min(Math.max(rules.minBet, rules.minBet), rules.maxBet),
    roundNumber: 0,
    summary: null,
    message: 'Place your bet.',
    shufflePending: false,
  };
}

/* ------------------------------------------------------------------ *
 * Derived helpers
 * ------------------------------------------------------------------ */

export function activeHand(state: GameState): PlayerHand | null {
  return state.hands[state.activeHandIndex] ?? null;
}

export function dealerUpcard(state: GameState): Card | null {
  return state.dealer.cards[0] ?? null;
}

/** The dealer total the player is allowed to see (hides the hole card). */
export function visibleDealerValue(state: GameState): HandValue {
  const visible = state.dealer.holeCardHidden ? state.dealer.cards.slice(0, 1) : state.dealer.cards;
  return handValue(visible);
}

export function totalWagered(state: GameState): number {
  return state.hands.reduce((sum, hand) => sum + hand.bet, 0) + state.insuranceBet;
}

export function canDouble(state: GameState, hand: PlayerHand | null = activeHand(state)): boolean {
  if (!hand || state.phase !== 'playerTurn' || hand.done) return false;
  if (hand.cards.length !== 2) return false;
  if (hand.fromSplitAces && state.rules.splitAcesOneCardOnly) return false;
  if (hand.fromSplit && !state.rules.doubleAfterSplit) return false;
  if (state.bankroll < hand.bet) return false;
  if (!state.rules.doubleOnAnyTwo) {
    const value = handValue(hand.cards);
    if (!state.rules.doubleTotals.includes(value.total)) return false;
  }
  return true;
}

export function canSplit(state: GameState, hand: PlayerHand | null = activeHand(state)): boolean {
  if (!hand || state.phase !== 'playerTurn' || hand.done) return false;
  if (!isPair(hand.cards)) return false;
  if (state.hands.length >= state.rules.maxSplitHands) return false;
  if (state.bankroll < hand.bet) return false;
  if (hand.fromSplitAces && !state.rules.resplitAces) return false;
  return true;
}

export function canSurrender(
  state: GameState,
  hand: PlayerHand | null = activeHand(state),
): boolean {
  if (!hand || state.phase !== 'playerTurn' || hand.done) return false;
  if (!state.rules.surrenderAllowed) return false;
  if (hand.fromSplit) return false;
  return hand.cards.length === 2;
}

export function canHit(state: GameState, hand: PlayerHand | null = activeHand(state)): boolean {
  if (!hand || state.phase !== 'playerTurn' || hand.done) return false;
  if (hand.fromSplitAces && state.rules.splitAcesOneCardOnly) return false;
  return handValue(hand.cards).total < 21;
}

export function canStand(state: GameState, hand: PlayerHand | null = activeHand(state)): boolean {
  return Boolean(hand) && state.phase === 'playerTurn' && !hand!.done;
}

export function availableActions(state: GameState): Record<PlayerAction, boolean> {
  return {
    hit: canHit(state),
    stand: canStand(state),
    double: canDouble(state),
    split: canSplit(state),
    surrender: canSurrender(state),
  };
}

export function legalBet(state: GameState, amount: number): boolean {
  const { minBet, maxBet } = state.rules;
  return (
    Number.isFinite(amount) && amount >= minBet && amount <= maxBet && amount <= state.bankroll
  );
}

export function maxInsuranceBet(state: GameState): number {
  const main = state.hands[0]?.bet ?? 0;
  return Math.min(main / 2, state.bankroll);
}

/* ------------------------------------------------------------------ *
 * Round lifecycle
 * ------------------------------------------------------------------ */

function dealerHasBlackjack(state: GameState): boolean {
  return state.dealer.cards.length === 2 && isNaturalBlackjack(state.dealer.cards);
}

function dealerShowsTenOrAce(state: GameState): boolean {
  const up = dealerUpcard(state);
  return up ? rankValue(up.rank) >= 10 : false;
}

export function placeBet(state: GameState, amount: number): GameState {
  if (state.phase !== 'betting') return state;
  if (!legalBet(state, amount)) return state;
  return { ...state, lastBet: amount };
}

/** Starts a round: takes the bet, deals two cards each, and routes to the right phase. */
export function deal(state: GameState, betAmount?: number, randomInt?: RandomInt): GameState {
  if (state.phase !== 'betting' && state.phase !== 'settled') return state;
  const bet = betAmount ?? state.lastBet;
  const base: GameState = { ...state, phase: 'betting' };
  if (!legalBet(base, bet)) {
    return { ...base, message: `Bet must be between ${state.rules.minBet} and ${state.rules.maxBet}.` };
  }

  let shoe = state.shoe;
  if (state.shufflePending || needsShuffle(shoe)) {
    shoe = reshuffleShoe(shoe, randomInt);
  }

  const playerCards: Card[] = [];
  const dealerCards: Card[] = [];
  for (let i = 0; i < 2; i += 1) {
    const p = draw(shoe, randomInt);
    playerCards.push(p.card);
    shoe = p.shoe;
    const d = draw(shoe, randomInt);
    dealerCards.push(d.card);
    shoe = d.shoe;
  }

  const hand = emptyHand(bet, playerCards);

  let next: GameState = {
    ...state,
    shoe,
    bankroll: state.bankroll - bet,
    phase: 'playerTurn',
    hands: [hand],
    activeHandIndex: 0,
    dealer: { cards: dealerCards, holeCardHidden: true },
    insuranceBet: 0,
    insuranceOffered: false,
    insuranceResolved: false,
    insuranceNet: 0,
    lastBet: bet,
    roundNumber: state.roundNumber + 1,
    summary: null,
    message: 'Your move.',
    shufflePending: false,
  };

  const up = dealerCards[0]!;
  if (state.rules.insuranceAllowed && up.rank === 'A') {
    return {
      ...next,
      phase: 'insurance',
      insuranceOffered: true,
      message: 'Dealer shows an ace. Insurance?',
    };
  }

  if (state.rules.dealerPeeks && dealerShowsTenOrAce(next) && dealerHasBlackjack(next)) {
    return settle(revealHole(next));
  }

  if (isNaturalBlackjack(playerCards)) {
    next = { ...next, hands: [{ ...hand, done: true }] };
    return settle(revealHole(next));
  }

  return next;
}

function revealHole(state: GameState): GameState {
  return { ...state, dealer: { ...state.dealer, holeCardHidden: false } };
}

export function takeInsurance(state: GameState, amount?: number): GameState {
  if (state.phase !== 'insurance') return state;
  const max = maxInsuranceBet(state);
  const bet = Math.min(amount ?? max, max);
  if (bet <= 0) return declineInsurance(state);
  return resolveInsurance({ ...state, insuranceBet: bet, bankroll: state.bankroll - bet });
}

export function declineInsurance(state: GameState): GameState {
  if (state.phase !== 'insurance') return state;
  return resolveInsurance(state);
}

function resolveInsurance(state: GameState): GameState {
  const hasBlackjack = dealerHasBlackjack(state);
  let insuranceNet = 0;
  let bankroll = state.bankroll;

  if (state.insuranceBet > 0) {
    if (hasBlackjack) {
      const returned = state.insuranceBet * (1 + state.rules.insurancePayout);
      bankroll += returned;
      insuranceNet = state.insuranceBet * state.rules.insurancePayout;
    } else {
      insuranceNet = -state.insuranceBet;
    }
  }

  const next: GameState = {
    ...state,
    bankroll,
    insuranceNet,
    insuranceResolved: true,
    phase: 'playerTurn',
    message: hasBlackjack ? 'Dealer has blackjack.' : 'No dealer blackjack. Your move.',
  };

  if (hasBlackjack) {
    return settle(revealHole(next));
  }
  const hand = next.hands[0]!;
  if (isNaturalBlackjack(hand.cards)) {
    return settle(revealHole({ ...next, hands: [{ ...hand, done: true }] }));
  }
  return next;
}

/* ------------------------------------------------------------------ *
 * Player actions
 * ------------------------------------------------------------------ */

function replaceHand(state: GameState, index: number, hand: PlayerHand): GameState {
  const hands = state.hands.slice();
  hands[index] = hand;
  return { ...state, hands };
}

/** Moves to the next unfinished hand, or hands off to the dealer. */
function advance(state: GameState): GameState {
  let index = state.activeHandIndex;
  while (index < state.hands.length && state.hands[index]!.done) {
    index += 1;
  }
  if (index < state.hands.length) {
    return { ...state, activeHandIndex: index, message: `Playing hand ${index + 1}.` };
  }

  const anyLive = state.hands.some(
    (hand) => !hand.surrendered && !handValue(hand.cards).busted,
  );
  const revealed = revealHole({ ...state, activeHandIndex: state.hands.length - 1 });
  if (!anyLive) {
    return settle(revealed);
  }
  return playDealer({ ...revealed, phase: 'dealerTurn' });
}

export function hit(state: GameState, randomInt?: RandomInt): GameState {
  if (!canHit(state)) return state;
  const index = state.activeHandIndex;
  const hand = state.hands[index]!;
  const { card, shoe } = draw(state.shoe, randomInt);
  const cards = [...hand.cards, card];
  const value = handValue(cards);
  const updated: PlayerHand = {
    ...hand,
    cards,
    done: value.busted || value.total === 21,
  };
  const next = replaceHand({ ...state, shoe }, index, updated);
  return updated.done ? advance(next) : next;
}

export function stand(state: GameState): GameState {
  if (!canStand(state)) return state;
  const index = state.activeHandIndex;
  const hand = state.hands[index]!;
  return advance(replaceHand(state, index, { ...hand, done: true }));
}

export function double(state: GameState, randomInt?: RandomInt): GameState {
  if (!canDouble(state)) return state;
  const index = state.activeHandIndex;
  const hand = state.hands[index]!;
  const { card, shoe } = draw(state.shoe, randomInt);
  const updated: PlayerHand = {
    ...hand,
    cards: [...hand.cards, card],
    bet: hand.bet * 2,
    doubled: true,
    done: true,
  };
  const next = replaceHand(
    { ...state, shoe, bankroll: state.bankroll - hand.bet },
    index,
    updated,
  );
  return advance(next);
}

export function split(state: GameState, randomInt?: RandomInt): GameState {
  if (!canSplit(state)) return state;
  const index = state.activeHandIndex;
  const hand = state.hands[index]!;
  const splittingAces = isAcePair(hand.cards);

  let shoe = state.shoe;
  const firstDraw = draw(shoe, randomInt);
  shoe = firstDraw.shoe;
  const secondDraw = draw(shoe, randomInt);
  shoe = secondDraw.shoe;

  const acesLocked = splittingAces && state.rules.splitAcesOneCardOnly;
  const handsAfterSplit = state.hands.length + 1;
  const canResplitAces =
    splittingAces && state.rules.resplitAces && handsAfterSplit < state.rules.maxSplitHands;

  const makeSplitHand = (original: Card, drawn: Card): PlayerHand => {
    const cards = [original, drawn];
    const value = handValue(cards);
    const lockedByAceRule = acesLocked && !(canResplitAces && isPair(cards));
    return emptyHand(hand.bet, cards, {
      fromSplit: true,
      fromSplitAces: splittingAces,
      done: lockedByAceRule || value.total === 21 || value.busted,
    });
  };

  const left = makeSplitHand(hand.cards[0]!, firstDraw.card);
  const right = makeSplitHand(hand.cards[1]!, secondDraw.card);

  const hands = state.hands.slice();
  hands.splice(index, 1, left, right);

  const next: GameState = {
    ...state,
    shoe,
    bankroll: state.bankroll - hand.bet,
    hands,
    message: 'Split.',
  };

  return left.done ? advance(next) : next;
}

export function surrender(state: GameState): GameState {
  if (!canSurrender(state)) return state;
  const index = state.activeHandIndex;
  const hand = state.hands[index]!;
  return advance(replaceHand(state, index, { ...hand, surrendered: true, done: true }));
}

export function applyAction(
  state: GameState,
  action: PlayerAction,
  randomInt?: RandomInt,
): GameState {
  switch (action) {
    case 'hit':
      return hit(state, randomInt);
    case 'stand':
      return stand(state);
    case 'double':
      return double(state, randomInt);
    case 'split':
      return split(state, randomInt);
    case 'surrender':
      return surrender(state);
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ *
 * Dealer play and settlement
 * ------------------------------------------------------------------ */

export function dealerShouldHit(cards: readonly Card[], rules: BlackjackRules): boolean {
  const value = handValue(cards);
  if (value.total < 17) return true;
  if (value.total === 17 && value.soft && rules.dealerHitsSoft17) return true;
  return false;
}

export function playDealer(state: GameState, randomInt?: RandomInt): GameState {
  const cards = state.dealer.cards.slice();
  let shoe = state.shoe;
  let guard = 0;
  while (dealerShouldHit(cards, state.rules) && guard < 24) {
    const result = draw(shoe, randomInt);
    cards.push(result.card);
    shoe = result.shoe;
    guard += 1;
  }
  return settle({
    ...state,
    shoe,
    dealer: { cards, holeCardHidden: false },
    phase: 'dealerTurn',
  });
}

interface Settlement {
  outcome: HandOutcome;
  returned: number;
  net: number;
}

/** Pure payout math for a single hand against a finished dealer hand. */
export function settleHand(
  hand: PlayerHand,
  dealerCards: readonly Card[],
  rules: BlackjackRules,
): Settlement {
  const bet = hand.bet;

  if (hand.surrendered) {
    return { outcome: 'surrender', returned: bet / 2, net: -bet / 2 };
  }

  const playerValue = handValue(hand.cards);
  // A natural requires the original two cards; 21 after a split is just 21.
  const playerBlackjack = !hand.fromSplit && isNaturalBlackjack(hand.cards);
  const dealerValue = handValue(dealerCards);
  const dealerBlackjack = dealerCards.length === 2 && isNaturalBlackjack(dealerCards);

  if (playerValue.busted) {
    return { outcome: 'bust', returned: 0, net: -bet };
  }

  if (playerBlackjack && dealerBlackjack) {
    return { outcome: 'push', returned: bet, net: 0 };
  }
  if (playerBlackjack) {
    const winnings = bet * rules.blackjackPayout;
    return { outcome: 'blackjack', returned: bet + winnings, net: winnings };
  }
  if (dealerBlackjack) {
    return { outcome: 'dealerBlackjack', returned: 0, net: -bet };
  }

  if (dealerValue.busted) {
    return { outcome: 'win', returned: bet * 2, net: bet };
  }
  if (playerValue.total > dealerValue.total) {
    return { outcome: 'win', returned: bet * 2, net: bet };
  }
  if (playerValue.total < dealerValue.total) {
    return { outcome: 'lose', returned: 0, net: -bet };
  }
  return { outcome: 'push', returned: bet, net: 0 };
}

export function settle(state: GameState): GameState {
  const dealerCards = state.dealer.cards;
  let bankroll = state.bankroll;
  let net = 0;
  let wagered = 0;

  const hands = state.hands.map((hand) => {
    const result = settleHand(hand, dealerCards, state.rules);
    bankroll += result.returned;
    net += result.net;
    wagered += hand.bet;
    return { ...hand, done: true, outcome: result.outcome, returned: result.returned, net: result.net };
  });

  const summary: RoundSummary = {
    net: net + state.insuranceNet,
    wagered: wagered + state.insuranceBet,
    outcomes: hands.map((hand) => hand.outcome!),
    insuranceNet: state.insuranceNet,
  };

  return {
    ...state,
    bankroll,
    hands,
    phase: 'settled',
    dealer: { cards: dealerCards, holeCardHidden: false },
    summary,
    message: summarize(summary),
    shufflePending: needsShuffle(state.shoe),
  };
}

function summarize(summary: RoundSummary): string {
  if (summary.outcomes.includes('blackjack') && summary.outcomes.length === 1) {
    return `Blackjack! +${formatChips(summary.net)}`;
  }
  if (summary.net > 0) return `You win +${formatChips(summary.net)}`;
  if (summary.net < 0) return `You lose ${formatChips(summary.net)}`;
  return 'Push.';
}

export function formatChips(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2);
}

/** Clears the table and returns to the betting phase. */
export function nextRound(state: GameState): GameState {
  if (state.phase !== 'settled') return state;
  return {
    ...state,
    phase: 'betting',
    hands: [],
    activeHandIndex: 0,
    dealer: { cards: [], holeCardHidden: true },
    insuranceBet: 0,
    insuranceOffered: false,
    insuranceResolved: false,
    insuranceNet: 0,
    summary: null,
    message: state.bankroll < state.rules.minBet ? 'Out of chips — reset the bankroll.' : 'Place your bet.',
  };
}

export function resetBankroll(state: GameState, amount?: number): GameState {
  return {
    ...state,
    bankroll: amount ?? state.rules.startingBankroll,
    phase: 'betting',
    hands: [],
    activeHandIndex: 0,
    dealer: { cards: [], holeCardHidden: true },
    insuranceBet: 0,
    insuranceOffered: false,
    insuranceResolved: false,
    insuranceNet: 0,
    summary: null,
    message: 'Place your bet.',
  };
}

export const OUTCOME_LABEL: Record<HandOutcome, string> = {
  blackjack: 'Blackjack',
  win: 'Win',
  push: 'Push',
  lose: 'Lose',
  bust: 'Bust',
  surrender: 'Surrendered',
  dealerBlackjack: 'Dealer blackjack',
};
