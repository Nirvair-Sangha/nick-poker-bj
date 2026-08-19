import { useEffect, useState } from 'react';
import { BlackjackScreen } from './ui/blackjack/BlackjackScreen';
import { Home, type GameId } from './ui/Home';
import { loadStats, type CoachStats } from './ui/stats';

type View = 'home' | GameId;

export function App() {
  const [view, setView] = useState<View>('home');
  const [stats, setStats] = useState<CoachStats>(loadStats);

  // The blackjack screen owns stats while it's mounted; refresh on the way back.
  useEffect(() => {
    if (view === 'home') setStats(loadStats());
  }, [view]);

  if (view === 'blackjack') {
    return <BlackjackScreen onExit={() => setView('home')} />;
  }

  return <Home stats={stats} onPick={setView} />;
}
