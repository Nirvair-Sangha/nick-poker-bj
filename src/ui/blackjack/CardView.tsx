import { isRedSuit, SUIT_SYMBOL, type Card } from '../../engine/cards';

interface CardViewProps {
  card?: Card;
  faceDown?: boolean;
  small?: boolean;
}

export function CardView({ card, faceDown = false, small = false }: CardViewProps) {
  const classes = ['card', small ? 'card--small' : '', faceDown ? 'card--back' : '']
    .filter(Boolean)
    .join(' ');

  if (faceDown || !card) {
    return <div className={classes} aria-label="Face-down card" />;
  }

  const red = isRedSuit(card.suit);
  return (
    <div
      className={`${classes} ${red ? 'card--red' : 'card--black'}`}
      aria-label={`${card.rank} of ${card.suit}`}
    >
      <span className="card__corner card__corner--tl">
        <span className="card__rank">{card.rank}</span>
        <span className="card__suit">{SUIT_SYMBOL[card.suit]}</span>
      </span>
      <span className="card__pip">{SUIT_SYMBOL[card.suit]}</span>
      <span className="card__corner card__corner--br">
        <span className="card__rank">{card.rank}</span>
        <span className="card__suit">{SUIT_SYMBOL[card.suit]}</span>
      </span>
    </div>
  );
}

interface CardRowProps {
  cards: readonly Card[];
  hideSecond?: boolean;
  small?: boolean;
}

export function CardRow({ cards, hideSecond = false, small = false }: CardRowProps) {
  return (
    <div className="card-row">
      {cards.map((card, index) => (
        <CardView
          key={card.id + index}
          card={card}
          faceDown={hideSecond && index === 1}
          small={small}
        />
      ))}
    </div>
  );
}
