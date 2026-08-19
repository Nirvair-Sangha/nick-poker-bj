import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  activeHand,
  applyAction,
  availableActions,
  createGame,
  deal,
  dealerUpcard,
  declineInsurance,
  formatChips,
  maxInsuranceBet,
  nextRound,
  OUTCOME_LABEL,
  resetBankroll,
  takeInsurance,
  visibleDealerValue,
  type GameState,
  type PlayerHand,
} from '../../engine/blackjack/game';
import { handValue } from '../../engine/blackjack/hand';
import { describeRules, makeRules } from '../../engine/blackjack/rules';
import {
  actionLabel,
  getStrategyAdvice,
  insuranceAdvice,
  type PlayerAction,
  type StrategyAdvice,
} from '../../engine/blackjack/strategy';
import {
  loadBankroll,
  loadSettings,
  loadStats,
  recordDecision,
  recordRound,
  saveBankroll,
  saveSettings,
  saveStats,
} from '../stats';
import { BetControls } from './BetControls';
import { CardRow, CardView } from './CardView';
import { HintPanel } from './HintPanel';

const RULES = makeRules();

interface PendingDeviation {
  action: PlayerAction;
  advice: StrategyAdvice;
}

export function BlackjackScreen({ onExit }: { onExit: () => void }) {
  const [game, setGame] = useState<GameState>(() =>
    createGame({ rules: RULES, bankroll: loadBankroll(RULES.startingBankroll) }),
  );
  const [stats, setStats] = useState(loadStats);
  const [settings, setSettings] = useState(loadSettings);
  const [bet, setBet] = useState(() => Math.max(RULES.minBet, settingsChipDefault()));
  const [pending, setPending] = useState<PendingDeviation | null>(null);
  const [showRules, setShowRules] = useState(false);
  const recordedRound = useRef(0);

  useEffect(() => saveBankroll(game.bankroll), [game.bankroll]);
  useEffect(() => saveStats(stats), [stats]);
  useEffect(() => saveSettings(settings), [settings]);

  // Fold each finished round into the lifetime stats exactly once.
  useEffect(() => {
    if (game.phase !== 'settled' || !game.summary) return;
    if (recordedRound.current === game.roundNumber) return;
    recordedRound.current = game.roundNumber;
    const summary = game.summary;
    const handCount = game.hands.length;
    setStats((current) => recordRound(current, summary.net, handCount));
  }, [game.phase, game.roundNumber, game.summary, game.hands.length]);

  const actions = useMemo(() => availableActions(game), [game]);

  const advice = useMemo<StrategyAdvice | null>(() => {
    if (game.phase !== 'playerTurn') return null;
    const hand = activeHand(game);
    const up = dealerUpcard(game);
    if (!hand || !up || hand.done) return null;
    return getStrategyAdvice(hand.cards, up, game.rules, actions);
  }, [game, actions]);

  const performAction = useCallback(
    (action: PlayerAction, recommendation: StrategyAdvice | null) => {
      if (recommendation) {
        setStats((current) => recordDecision(current, action, recommendation.action));
      }
      setGame((current) => applyAction(current, action));
      setPending(null);
    },
    [],
  );

  const requestAction = useCallback(
    (action: PlayerAction) => {
      if (settings.strictCoach && advice && action !== advice.action) {
        setPending({ action, advice });
        return;
      }
      performAction(action, advice);
    },
    [advice, performAction, settings.strictCoach],
  );

  const dealerValue = visibleDealerValue(game);
  const insurance = insuranceAdvice();
  const activeIndex = game.phase === 'playerTurn' ? game.activeHandIndex : -1;

  return (
    <div className="screen screen--table">
      <header className="topbar">
        <button type="button" className="topbar__back" onClick={onExit} aria-label="Back to menu">
          ‹
        </button>
        <div className="topbar__title">Blackjack</div>
        <button
          type="button"
          className="topbar__info"
          onClick={() => setShowRules((v) => !v)}
          aria-label="Table rules"
        >
          i
        </button>
      </header>

      <div className="bankbar">
        <div>
          <span className="bankbar__label">Bankroll</span>
          <span className="bankbar__value">{formatChips(game.bankroll)}</span>
        </div>
        <div>
          <span className="bankbar__label">Session</span>
          <span
            className={`bankbar__value ${stats.netChips >= 0 ? 'is-up' : 'is-down'}`}
          >
            {stats.netChips >= 0 ? '+' : ''}
            {formatChips(stats.netChips)}
          </span>
        </div>
        <div>
          <span className="bankbar__label">Hands</span>
          <span className="bankbar__value">{stats.handsPlayed}</span>
        </div>
      </div>

      {showRules ? (
        <div className="rules-sheet">
          <ul>
            {describeRules(game.rules).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <main className="table">
        <section className="seat seat--dealer">
          <div className="seat__label">
            Dealer
            {game.dealer.cards.length > 0 ? (
              <span className="seat__total">
                {game.dealer.holeCardHidden ? `${dealerValue.total}+` : dealerValue.total}
              </span>
            ) : null}
          </div>
          {game.dealer.cards.length > 0 ? (
            <CardRow cards={game.dealer.cards} hideSecond={game.dealer.holeCardHidden} />
          ) : (
            <div className="card-row card-row--empty">
              <CardView faceDown />
              <CardView faceDown />
            </div>
          )}
        </section>

        <section className="seat seat--player">
          <div className="seat__label">You</div>
          <div className={`hands ${game.hands.length > 1 ? 'hands--split' : ''}`}>
            {game.hands.length === 0 ? (
              <div className="card-row card-row--empty">
                <CardView faceDown />
                <CardView faceDown />
              </div>
            ) : (
              game.hands.map((hand, index) => (
                <HandView
                  key={hand.id}
                  hand={hand}
                  active={index === activeIndex}
                  compact={game.hands.length > 1}
                />
              ))
            )}
          </div>
        </section>

        <p className={`message ${game.phase === 'settled' ? 'message--result' : ''}`}>
          {game.message}
        </p>
      </main>

      <HintPanel
        advice={advice}
        stats={stats}
        showHints={settings.showHints}
        strictCoach={settings.strictCoach}
        onToggleHints={() => setSettings((s) => ({ ...s, showHints: !s.showHints }))}
        onToggleStrict={() => setSettings((s) => ({ ...s, strictCoach: !s.strictCoach }))}
      />

      <footer className="controls">
        {game.phase === 'betting' ? (
          <BetControls
            bet={bet}
            bankroll={game.bankroll}
            rules={game.rules}
            onChange={setBet}
            onDeal={() => setGame((current) => deal(current, bet))}
            onResetBankroll={() => setGame((current) => resetBankroll(current))}
          />
        ) : null}

        {game.phase === 'insurance' ? (
          <div className="insurance">
            <p className="insurance__prompt">
              Dealer shows an ace. Insurance costs {formatChips(maxInsuranceBet(game))} and pays 2:1.
            </p>
            {settings.showHints ? <p className="insurance__hint">{insurance.reason}</p> : null}
            <div className="action-row">
              <button
                type="button"
                className="action"
                onClick={() => setGame((current) => takeInsurance(current))}
              >
                Insure
              </button>
              <button
                type="button"
                className="action action--primary"
                onClick={() => setGame((current) => declineInsurance(current))}
              >
                No insurance
              </button>
            </div>
          </div>
        ) : null}

        {game.phase === 'playerTurn' ? (
          <div className="action-row action-row--play">
            <ActionButton
              action="hit"
              enabled={actions.hit}
              advised={advice?.action === 'hit'}
              onPress={requestAction}
            />
            <ActionButton
              action="stand"
              enabled={actions.stand}
              advised={advice?.action === 'stand'}
              onPress={requestAction}
            />
            <ActionButton
              action="double"
              enabled={actions.double}
              advised={advice?.action === 'double'}
              onPress={requestAction}
            />
            <ActionButton
              action="split"
              enabled={actions.split}
              advised={advice?.action === 'split'}
              onPress={requestAction}
            />
            {game.rules.surrenderAllowed ? (
              <ActionButton
                action="surrender"
                enabled={actions.surrender}
                advised={advice?.action === 'surrender'}
                onPress={requestAction}
              />
            ) : null}
          </div>
        ) : null}

        {game.phase === 'settled' ? (
          <div className="settled">
            <button
              type="button"
              className="action action--primary"
              onClick={() => setGame((current) => nextRound(current))}
            >
              Next hand
            </button>
          </div>
        ) : null}
      </footer>

      {pending ? (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__card">
            <h2 className="modal__title">That&apos;s not the book play</h2>
            <p className="modal__body">
              Basic strategy says <strong>{actionLabel(pending.advice.action)}</strong>. You picked{' '}
              <strong>{actionLabel(pending.action)}</strong>.
            </p>
            <p className="modal__reason">{pending.advice.reason}</p>
            <div className="action-row">
              <button type="button" className="action" onClick={() => setPending(null)}>
                Go back
              </button>
              <button
                type="button"
                className="action action--danger"
                onClick={() => performAction(pending.action, pending.advice)}
              >
                {actionLabel(pending.action)} anyway
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function settingsChipDefault(): number {
  return loadSettings().chipSize;
}

function ActionButton({
  action,
  enabled,
  advised,
  onPress,
}: {
  action: PlayerAction;
  enabled: boolean;
  advised: boolean;
  onPress: (action: PlayerAction) => void;
}) {
  return (
    <button
      type="button"
      className={`action action--play ${advised ? 'is-advised' : ''}`}
      disabled={!enabled}
      onClick={() => onPress(action)}
    >
      {actionLabel(action)}
    </button>
  );
}

function HandView({
  hand,
  active,
  compact,
}: {
  hand: PlayerHand;
  active: boolean;
  compact: boolean;
}) {
  const value = handValue(hand.cards);
  return (
    <div className={`hand ${active ? 'is-active' : ''}`}>
      <div className="hand__meta">
        <span className="hand__bet">{formatChips(hand.bet)}</span>
        <span className="hand__total">
          {value.soft && !value.busted ? `soft ${value.total}` : value.total}
        </span>
        {hand.outcome ? (
          <span className={`hand__outcome hand__outcome--${hand.outcome}`}>
            {OUTCOME_LABEL[hand.outcome]}
          </span>
        ) : null}
      </div>
      <CardRow cards={hand.cards} small={compact} />
    </div>
  );
}
