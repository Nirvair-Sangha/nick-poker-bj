import { describe, expect, it } from 'vitest';
import { cards, createStackedShoe, type Card } from '../cards';
import { makeRules } from './rules';
import {
  activeHand,
  availableActions,
  canSplit,
  createGame,
  deal,
  dealerShouldHit,
  declineInsurance,
  double,
  hit,
  nextRound,
  settleHand,
  split,
  stand,
  surrender,
  takeInsurance,
  type GameState,
  type PlayerHand,
} from './game';

/**
 * The deal order is player, dealer, player, dealer — so a stacked shoe reads
 * [player1, dealerUp, player2, dealerHole, ...rest].
 */
function gameWith(stack: string[], overrides: Parameters<typeof makeRules>[0] = {}) {
  return createGame({
    rules: overrides,
    shoe: createStackedShoe(cards(...stack)),
  });
}

function hand(bet: number, notations: string[], extra: Partial<PlayerHand> = {}): PlayerHand {
  return {
    id: 'test',
    cards: cards(...notations),
    bet,
    doubled: false,
    surrendered: false,
    fromSplit: false,
    fromSplitAces: false,
    done: true,
    outcome: null,
    returned: 0,
    net: 0,
    ...extra,
  };
}

const RULES = makeRules();

describe('dealing', () => {
  it('deals two cards each and hides the hole card', () => {
    const state = deal(gameWith(['10S', '9H', '7D', '8C']), 100);
    expect(state.hands[0]!.cards).toHaveLength(2);
    expect(state.dealer.cards).toHaveLength(2);
    expect(state.dealer.holeCardHidden).toBe(true);
    expect(state.phase).toBe('playerTurn');
    expect(state.bankroll).toBe(900);
  });

  it('rejects a bet outside the table limits', () => {
    const state = deal(gameWith(['10S', '9H', '7D', '8C']), 1);
    expect(state.phase).toBe('betting');
    expect(state.bankroll).toBe(1000);
  });

  it('rejects a bet larger than the bankroll', () => {
    const game = { ...gameWith(['10S', '9H', '7D', '8C']), bankroll: 20 };
    expect(deal(game, 100).phase).toBe('betting');
  });
});

describe('naturals', () => {
  it('pays a player blackjack at 3:2 and ends the round immediately', () => {
    const state = deal(gameWith(['AS', '5H', 'KD', '9C']), 100);
    expect(state.phase).toBe('settled');
    expect(state.hands[0]!.outcome).toBe('blackjack');
    expect(state.hands[0]!.net).toBe(150);
    expect(state.bankroll).toBe(1150);
    expect(state.dealer.holeCardHidden).toBe(false);
  });

  it('honours a 6:5 payout when configured', () => {
    const state = deal(gameWith(['AS', '5H', 'KD', '9C'], { blackjackPayout: 1.2 }), 100);
    expect(state.hands[0]!.net).toBe(120);
  });

  it('pushes when both sides have blackjack', () => {
    let state = deal(gameWith(['AS', 'AH', 'KD', 'QC']), 100);
    expect(state.phase).toBe('insurance');
    state = declineInsurance(state);
    expect(state.phase).toBe('settled');
    expect(state.hands[0]!.outcome).toBe('push');
    expect(state.bankroll).toBe(1000);
  });

  it('loses to a dealer blackjack found on the peek', () => {
    const state = deal(gameWith(['10S', 'KH', '9D', 'AC']), 100);
    expect(state.phase).toBe('settled');
    expect(state.hands[0]!.outcome).toBe('dealerBlackjack');
    expect(state.bankroll).toBe(900);
  });
});

describe('insurance', () => {
  it('pays 2:1 when the dealer has blackjack, making the round a wash', () => {
    let state = deal(gameWith(['10S', 'AH', '6D', 'KC']), 100);
    expect(state.phase).toBe('insurance');
    state = takeInsurance(state, 50);
    expect(state.phase).toBe('settled');
    expect(state.insuranceNet).toBe(100);
    expect(state.summary!.net).toBe(0);
    expect(state.bankroll).toBe(1000);
  });

  it('loses the side bet and continues when the dealer has no blackjack', () => {
    let state = deal(gameWith(['10S', 'AH', '6D', '9C']), 100);
    state = takeInsurance(state, 50);
    expect(state.phase).toBe('playerTurn');
    expect(state.insuranceNet).toBe(-50);
    expect(state.bankroll).toBe(850);
  });

  it('caps the insurance bet at half the main bet', () => {
    let state = deal(gameWith(['10S', 'AH', '6D', '9C']), 100);
    state = takeInsurance(state, 500);
    expect(state.insuranceBet).toBe(50);
  });

  it('is not offered when disabled in the rules', () => {
    const state = deal(gameWith(['10S', 'AH', '6D', '9C'], { insuranceAllowed: false }), 100);
    expect(state.phase).toBe('playerTurn');
    expect(state.insuranceOffered).toBe(false);
  });
});

describe('player actions', () => {
  it('busts and ends the hand', () => {
    let state = deal(gameWith(['10S', '9H', '6D', '8C', 'KS']), 100);
    state = hit(state);
    expect(state.phase).toBe('settled');
    expect(state.hands[0]!.outcome).toBe('bust');
    expect(state.bankroll).toBe(900);
  });

  it('does not let the dealer draw when every hand busted', () => {
    let state = deal(gameWith(['10S', '6H', '6D', '5C', 'KS']), 100);
    state = hit(state);
    expect(state.dealer.cards).toHaveLength(2);
    expect(state.hands[0]!.outcome).toBe('bust');
  });

  it('doubles: takes exactly one card, doubles the wager, and stands', () => {
    let state = deal(gameWith(['6S', '9H', '5D', '8C', '10S', '2H']), 100);
    expect(availableActions(state).double).toBe(true);
    state = double(state);
    expect(state.hands[0]!.cards).toHaveLength(3);
    expect(state.hands[0]!.bet).toBe(200);
    expect(state.hands[0]!.doubled).toBe(true);
    expect(state.phase).toBe('settled');
    // Player 21, dealer 9+8=17 stands. Win 200.
    expect(state.hands[0]!.net).toBe(200);
    expect(state.bankroll).toBe(1200);
  });

  it('refuses to double on three cards', () => {
    let state = deal(gameWith(['3S', '9H', '4D', '8C', '2S']), 100);
    state = hit(state);
    expect(availableActions(state).double).toBe(false);
    const before = state;
    expect(double(state)).toBe(before);
  });

  it('surrenders for half the bet when the rule is enabled', () => {
    let state = deal(gameWith(['10S', 'KH', '6D', '7C'], { surrenderAllowed: true }), 100);
    expect(availableActions(state).surrender).toBe(true);
    state = surrender(state);
    expect(state.phase).toBe('settled');
    expect(state.hands[0]!.outcome).toBe('surrender');
    expect(state.hands[0]!.net).toBe(-50);
    expect(state.bankroll).toBe(950);
  });

  it('does not offer surrender by default', () => {
    const state = deal(gameWith(['10S', 'KH', '6D', '7C']), 100);
    expect(availableActions(state).surrender).toBe(false);
  });
});

describe('dealer play', () => {
  it('stands on soft 17 by default', () => {
    let state = deal(gameWith(['10S', '6H', '9D', 'AC']), 100);
    state = stand(state);
    expect(state.dealer.cards).toHaveLength(2);
    expect(state.hands[0]!.outcome).toBe('win');
  });

  it('hits soft 17 when configured', () => {
    let state = deal(gameWith(['10S', '6H', '9D', 'AC', '3S'], { dealerHitsSoft17: true }), 100);
    state = stand(state);
    expect(state.dealer.cards).toHaveLength(3);
    // 6 + A + 3 = 20 beats the player's 19.
    expect(state.hands[0]!.outcome).toBe('lose');
  });

  it('draws until it reaches 17', () => {
    let state = deal(gameWith(['10S', '5H', '9D', '4C', '2S', '6H']), 100);
    state = stand(state);
    // 5 + 4 = 9, +2 = 11, +6 = 17.
    expect(state.dealer.cards).toHaveLength(4);
    expect(state.hands[0]!.outcome).toBe('win');
  });

  it('busts and pays every standing hand', () => {
    let state = deal(gameWith(['10S', '10H', '5D', '6C', 'KS']), 100);
    state = stand(state);
    expect(state.hands[0]!.outcome).toBe('win');
    expect(state.bankroll).toBe(1100);
  });

  it('exposes the drawing rule directly', () => {
    expect(dealerShouldHit(cards('10S', '6D'), RULES)).toBe(true);
    expect(dealerShouldHit(cards('10S', '7D'), RULES)).toBe(false);
    expect(dealerShouldHit(cards('AS', '6D'), RULES)).toBe(false);
    expect(dealerShouldHit(cards('AS', '6D'), makeRules({ dealerHitsSoft17: true }))).toBe(true);
    expect(dealerShouldHit(cards('AS', '7D'), makeRules({ dealerHitsSoft17: true }))).toBe(false);
  });
});

describe('splitting', () => {
  it('creates two hands and takes a second bet', () => {
    let state = deal(gameWith(['8S', '9H', '8D', '7C', '3S', '2H']), 100);
    expect(availableActions(state).split).toBe(true);
    state = split(state);
    expect(state.hands).toHaveLength(2);
    expect(state.bankroll).toBe(800);
    expect(state.hands[0]!.cards.map((c: Card) => c.rank)).toEqual(['8', '3']);
    expect(state.hands[1]!.cards.map((c: Card) => c.rank)).toEqual(['8', '2']);
    expect(state.hands.every((h) => h.fromSplit)).toBe(true);
  });

  it('plays each split hand in turn', () => {
    let state = deal(gameWith(['8S', '9H', '8D', '7C', '3S', '2H', '10S', '10H']), 100);
    state = split(state);
    expect(state.activeHandIndex).toBe(0);
    state = stand(state);
    expect(state.activeHandIndex).toBe(1);
    expect(state.phase).toBe('playerTurn');
    state = stand(state);
    expect(state.phase).toBe('settled');
  });

  it('gives split aces exactly one card each and locks them', () => {
    let state = deal(gameWith(['AS', '10H', 'AD', '9C', 'KS', 'KD']), 100);
    state = split(state);
    expect(state.hands).toHaveLength(2);
    expect(state.hands.every((h) => h.done)).toBe(true);
    expect(state.phase).toBe('settled');
    expect(state.hands[0]!.cards).toHaveLength(2);
  });

  it('treats 21 after splitting aces as a plain 21, not a blackjack', () => {
    const state = split(deal(gameWith(['AS', '10H', 'AD', '9C', 'KS', 'KD']), 100));
    // Dealer has 10 + 9 = 19; both player hands are 21.
    expect(state.hands.map((h) => h.outcome)).toEqual(['win', 'win']);
    expect(state.hands[0]!.net).toBe(100);
    expect(state.summary!.net).toBe(200);
  });

  it('allows doubling after a split by default', () => {
    let state = deal(gameWith(['8S', '9H', '8D', '7C', '3S', '2H', '10S']), 100);
    state = split(state);
    expect(availableActions(state).double).toBe(true);
    state = double(state);
    expect(state.hands[0]!.bet).toBe(200);
  });

  it('forbids doubling after a split when the rule is off', () => {
    let state = deal(
      gameWith(['8S', '9H', '8D', '7C', '3S', '2H'], { doubleAfterSplit: false }),
      100,
    );
    state = split(state);
    expect(availableActions(state).double).toBe(false);
  });

  it('caps the number of split hands', () => {
    // 8,8 -> split -> 8,8 and 8,8 -> split each until 4 hands exist.
    let state = deal(
      gameWith(['8S', '9H', '8D', '7C', '8C', '8H', '8S', '8D', '2S', '3H', '4C', '5D']),
      100,
    );
    state = split(state); // hands: [8,8] [8,8]
    expect(state.hands).toHaveLength(2);
    state = split(state); // hands: [8,8] [8,8] [8,8] -> 3 hands
    expect(state.hands).toHaveLength(3);
    state = split(state);
    expect(state.hands).toHaveLength(4);
    expect(canSplit(state)).toBe(false);
    expect(state.bankroll).toBe(600);
  });

  it('refuses to split without enough bankroll', () => {
    const base = deal(gameWith(['8S', '9H', '8D', '7C', '3S', '2H']), 100);
    expect(canSplit({ ...base, bankroll: 10 })).toBe(false);
  });

  it('does not re-split aces by default', () => {
    let state = deal(gameWith(['AS', '9H', 'AD', '7C', 'AC', 'AH']), 100);
    state = split(state);
    expect(state.hands.every((h) => h.done)).toBe(true);
  });
});

describe('settlement math', () => {
  const dealer19 = cards('10S', '9D');
  const dealerBust = cards('10S', '9D', '5C');
  const dealerBlackjack = cards('AS', 'KD');

  it('pays a natural 3:2', () => {
    expect(settleHand(hand(100, ['AS', 'KD']), dealer19, RULES)).toEqual({
      outcome: 'blackjack',
      returned: 250,
      net: 150,
    });
  });

  it('pays a split 21 at even money', () => {
    expect(
      settleHand(hand(100, ['AS', 'KD'], { fromSplit: true }), dealer19, RULES),
    ).toEqual({ outcome: 'win', returned: 200, net: 100 });
  });

  it('pushes equal totals', () => {
    expect(settleHand(hand(100, ['10S', '9C']), dealer19, RULES)).toEqual({
      outcome: 'push',
      returned: 100,
      net: 0,
    });
  });

  it('loses a lower total', () => {
    expect(settleHand(hand(100, ['10S', '8C']), dealer19, RULES)).toEqual({
      outcome: 'lose',
      returned: 0,
      net: -100,
    });
  });

  it('wins a higher total', () => {
    expect(settleHand(hand(100, ['10S', 'KC']), dealer19, RULES)).toEqual({
      outcome: 'win',
      returned: 200,
      net: 100,
    });
  });

  it('loses a bust even when the dealer also busts', () => {
    expect(settleHand(hand(100, ['10S', 'KC', '5D']), dealerBust, RULES)).toEqual({
      outcome: 'bust',
      returned: 0,
      net: -100,
    });
  });

  it('pays every standing hand when the dealer busts', () => {
    expect(settleHand(hand(100, ['10S', '2C']), dealerBust, RULES)).toEqual({
      outcome: 'win',
      returned: 200,
      net: 100,
    });
  });

  it('pushes blackjack against blackjack', () => {
    expect(settleHand(hand(100, ['AS', 'KD']), dealerBlackjack, RULES)).toEqual({
      outcome: 'push',
      returned: 100,
      net: 0,
    });
  });

  it('loses a good hand to a dealer blackjack', () => {
    expect(settleHand(hand(100, ['10S', 'KD']), dealerBlackjack, RULES)).toEqual({
      outcome: 'dealerBlackjack',
      returned: 0,
      net: -100,
    });
  });

  it('returns half the bet on a surrender', () => {
    expect(settleHand(hand(100, ['10S', '6D'], { surrendered: true }), dealer19, RULES)).toEqual({
      outcome: 'surrender',
      returned: 50,
      net: -50,
    });
  });

  it('settles a doubled hand for the full doubled amount', () => {
    expect(settleHand(hand(200, ['5S', '6D', 'KC'], { doubled: true }), dealer19, RULES)).toEqual({
      outcome: 'win',
      returned: 400,
      net: 200,
    });
  });
});

describe('round lifecycle', () => {
  it('returns to betting and clears the table', () => {
    let state: GameState = deal(gameWith(['AS', '5H', 'KD', '9C']), 100);
    state = nextRound(state);
    expect(state.phase).toBe('betting');
    expect(state.hands).toHaveLength(0);
    expect(state.dealer.cards).toHaveLength(0);
    expect(state.summary).toBeNull();
  });

  it('remembers the last bet', () => {
    let state = deal(gameWith(['10S', '9H', '7D', '8C', '2S', '3H', '4C', '5D']), 250);
    expect(state.lastBet).toBe(250);
    state = nextRound(stand(state));
    expect(state.lastBet).toBe(250);
  });

  it('keeps a live active hand pointer during the player turn', () => {
    const state = deal(gameWith(['10S', '9H', '7D', '8C']), 100);
    expect(activeHand(state)!.cards).toHaveLength(2);
  });
});
