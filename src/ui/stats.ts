import type { PlayerAction } from '../engine/blackjack/strategy';
import { loadJSON, saveJSON } from './storage';

export interface CoachStats {
  /** Every player decision made while a recommendation was available. */
  decisions: number;
  /** Decisions that matched basic strategy. */
  correct: number;
  handsPlayed: number;
  roundsPlayed: number;
  netChips: number;
  currentStreak: number;
  bestStreak: number;
  /** Counts of the actions the player got wrong, for the mistakes breakdown. */
  missesByAction: Record<PlayerAction, number>;
}

export const EMPTY_STATS: CoachStats = {
  decisions: 0,
  correct: 0,
  handsPlayed: 0,
  roundsPlayed: 0,
  netChips: 0,
  currentStreak: 0,
  bestStreak: 0,
  missesByAction: { hit: 0, stand: 0, double: 0, split: 0, surrender: 0 },
};

const STATS_KEY = 'coach-stats';

export function loadStats(): CoachStats {
  const loaded = loadJSON<CoachStats>(STATS_KEY, EMPTY_STATS);
  return {
    ...EMPTY_STATS,
    ...loaded,
    missesByAction: { ...EMPTY_STATS.missesByAction, ...(loaded.missesByAction ?? {}) },
  };
}

export function saveStats(stats: CoachStats): void {
  saveJSON(STATS_KEY, stats);
}

export function recordDecision(
  stats: CoachStats,
  chosen: PlayerAction,
  recommended: PlayerAction,
): CoachStats {
  const correct = chosen === recommended;
  const currentStreak = correct ? stats.currentStreak + 1 : 0;
  return {
    ...stats,
    decisions: stats.decisions + 1,
    correct: stats.correct + (correct ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(stats.bestStreak, currentStreak),
    missesByAction: correct
      ? stats.missesByAction
      : { ...stats.missesByAction, [recommended]: (stats.missesByAction[recommended] ?? 0) + 1 },
  };
}

export function recordRound(stats: CoachStats, net: number, handCount: number): CoachStats {
  return {
    ...stats,
    roundsPlayed: stats.roundsPlayed + 1,
    handsPlayed: stats.handsPlayed + handCount,
    netChips: stats.netChips + net,
  };
}

export function accuracy(stats: CoachStats): number {
  if (stats.decisions === 0) return 0;
  return stats.correct / stats.decisions;
}

export function formatAccuracy(stats: CoachStats): string {
  if (stats.decisions === 0) return '—';
  return `${Math.round(accuracy(stats) * 100)}%`;
}

export interface Settings {
  showHints: boolean;
  strictCoach: boolean;
  chipSize: number;
}

export const DEFAULT_SETTINGS: Settings = {
  showHints: true,
  strictCoach: false,
  chipSize: 25,
};

const SETTINGS_KEY = 'settings';

export function loadSettings(): Settings {
  return loadJSON<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS);
}

export function saveSettings(settings: Settings): void {
  saveJSON(SETTINGS_KEY, settings);
}

const BANKROLL_KEY = 'bankroll';

export function loadBankroll(fallback: number): number {
  const value = loadJSON<number>(BANKROLL_KEY, fallback);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function saveBankroll(value: number): void {
  saveJSON(BANKROLL_KEY, value);
}
