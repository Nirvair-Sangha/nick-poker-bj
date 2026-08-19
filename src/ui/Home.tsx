import { formatAccuracy, type CoachStats } from './stats';

export type GameId = 'blackjack' | 'video-poker' | 'holdem';

interface GameEntry {
  id: GameId;
  title: string;
  blurb: string;
  suit: string;
  available: boolean;
}

const GAMES: GameEntry[] = [
  {
    id: 'blackjack',
    title: 'Blackjack',
    blurb: '6-deck shoe with a live basic-strategy coach.',
    suit: '\u2660',
    available: true,
  },
  {
    id: 'video-poker',
    title: 'Video Poker',
    blurb: 'Jacks or Better with optimal-hold hints.',
    suit: '\u2665',
    available: false,
  },
  {
    id: 'holdem',
    title: "Texas Hold'em",
    blurb: 'Heads-up against the house, with odds coaching.',
    suit: '\u2666',
    available: false,
  },
];

interface HomeProps {
  stats: CoachStats;
  onPick: (game: GameId) => void;
}

export function Home({ stats, onPick }: HomeProps) {
  return (
    <div className="screen screen--home">
      <header className="home__head">
        <h1 className="home__title">Nick Cards</h1>
        <p className="home__sub">Offline card trainer</p>
      </header>

      <section className="home__stats">
        <div>
          <span className="home__stat-value">{formatAccuracy(stats)}</span>
          <span className="home__stat-label">Strategy accuracy</span>
        </div>
        <div>
          <span className="home__stat-value">{stats.handsPlayed}</span>
          <span className="home__stat-label">Hands played</span>
        </div>
        <div>
          <span className={`home__stat-value ${stats.netChips >= 0 ? 'is-up' : 'is-down'}`}>
            {stats.netChips >= 0 ? '+' : ''}
            {stats.netChips}
          </span>
          <span className="home__stat-label">Net chips</span>
        </div>
      </section>

      <nav className="home__games">
        {GAMES.map((game) => (
          <button
            key={game.id}
            type="button"
            className={`game-card ${game.available ? '' : 'is-soon'}`}
            onClick={() => game.available && onPick(game.id)}
            disabled={!game.available}
          >
            <span className="game-card__suit" aria-hidden="true">
              {game.suit}
            </span>
            <span className="game-card__text">
              <span className="game-card__title">{game.title}</span>
              <span className="game-card__blurb">{game.blurb}</span>
            </span>
            <span className="game-card__badge">{game.available ? 'Play' : 'Coming soon'}</span>
          </button>
        ))}
      </nav>

      <footer className="home__foot">
        <p>Works offline. Add to your Home Screen from Safari&apos;s Share menu.</p>
      </footer>
    </div>
  );
}
