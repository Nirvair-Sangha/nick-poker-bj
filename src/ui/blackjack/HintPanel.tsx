import { actionLabel, type StrategyAdvice } from '../../engine/blackjack/strategy';
import { formatAccuracy, type CoachStats } from '../stats';

interface HintPanelProps {
  advice: StrategyAdvice | null;
  stats: CoachStats;
  showHints: boolean;
  strictCoach: boolean;
  onToggleHints: () => void;
  onToggleStrict: () => void;
}

export function HintPanel({
  advice,
  stats,
  showHints,
  strictCoach,
  onToggleHints,
  onToggleStrict,
}: HintPanelProps) {
  return (
    <section className="hint" aria-live="polite">
      <div className="hint__head">
        <span className="hint__title">Coach</span>
        <div className="hint__toggles">
          <button
            type="button"
            className={`chip-toggle ${showHints ? 'is-on' : ''}`}
            onClick={onToggleHints}
            aria-pressed={showHints}
          >
            Hints
          </button>
          <button
            type="button"
            className={`chip-toggle ${strictCoach ? 'is-on' : ''}`}
            onClick={onToggleStrict}
            aria-pressed={strictCoach}
          >
            Strict
          </button>
        </div>
      </div>

      {showHints && advice ? (
        <div className="hint__body">
          <div className="hint__action">{actionLabel(advice.action)}</div>
          <p className="hint__reason">{advice.reason}</p>
          {advice.constrained ? (
            <p className="hint__note">
              Book play would be {actionLabel(advice.idealAction).toLowerCase()}, but it isn&apos;t
              legal on this hand.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="hint__body hint__body--idle">
          {showHints ? 'Waiting for your hand…' : 'Hints are off — playing blind.'}
        </div>
      )}

      <dl className="hint__stats">
        <div>
          <dt>Accuracy</dt>
          <dd>{formatAccuracy(stats)}</dd>
        </div>
        <div>
          <dt>Decisions</dt>
          <dd>{stats.decisions}</dd>
        </div>
        <div>
          <dt>Streak</dt>
          <dd>
            {stats.currentStreak}
            <span className="hint__sub"> / {stats.bestStreak}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
