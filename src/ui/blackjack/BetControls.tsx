import { formatChips } from '../../engine/blackjack/game';
import type { BlackjackRules } from '../../engine/blackjack/rules';

const CHIP_VALUES = [5, 25, 100, 500];

interface BetControlsProps {
  bet: number;
  bankroll: number;
  rules: BlackjackRules;
  onChange: (bet: number) => void;
  onDeal: () => void;
  onResetBankroll: () => void;
}

export function BetControls({
  bet,
  bankroll,
  rules,
  onChange,
  onDeal,
  onResetBankroll,
}: BetControlsProps) {
  const broke = bankroll < rules.minBet;
  const canDeal = !broke && bet >= rules.minBet && bet <= Math.min(rules.maxBet, bankroll);

  const addChip = (value: number) => {
    const next = Math.min(bet + value, rules.maxBet, bankroll);
    onChange(Math.max(next, rules.minBet));
  };

  return (
    <div className="betting">
      <div className="betting__amount">
        <span className="betting__label">Bet</span>
        <span className="betting__value">{formatChips(bet)}</span>
      </div>

      <div className="chips">
        {CHIP_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            className={`chip chip--${value}`}
            onClick={() => addChip(value)}
            disabled={broke || bankroll < value}
          >
            {value}
          </button>
        ))}
        <button
          type="button"
          className="chip chip--clear"
          onClick={() => onChange(rules.minBet)}
          disabled={broke}
        >
          Clear
        </button>
      </div>

      {broke ? (
        <button type="button" className="action action--primary" onClick={onResetBankroll}>
          Reset bankroll to {formatChips(rules.startingBankroll)}
        </button>
      ) : (
        <button
          type="button"
          className="action action--primary"
          onClick={onDeal}
          disabled={!canDeal}
        >
          Deal
        </button>
      )}

      <p className="betting__limits">
        Table limits {formatChips(rules.minBet)}–{formatChips(rules.maxBet)}
      </p>
    </div>
  );
}
