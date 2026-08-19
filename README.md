# Nick Cards

**▶ Play it: <https://nirvair-sangha.github.io/nick-poker-bj/>** — open it in Safari on an iPhone
and *Share → Add to Home Screen*.

Offline-first PWA card trainer: **blackjack with a live basic-strategy coach**. No App Store, no
Apple Developer account, no backend, no network calls at runtime. You install it from Safari with
*Add to Home Screen* and it runs like a native app — including in airplane mode.

Milestone 1 ships **Blackjack, fully playable**. Video Poker and Texas Hold'em are visible in the
menu as *Coming soon* so the navigation shell already exists.

---

## What's in it

**A real 6-deck shoe.** Cards are dealt from a shuffled multi-deck shoe using Fisher–Yates seeded
from `crypto.getRandomValues()` — not `Math.random()`. The shoe reshuffles at 75% penetration.

**A complete state machine.** Betting → dealing → insurance → player actions → dealer play →
settlement. Splits (up to 4 hands), re-splits, double-after-split, split aces locked to one card,
insurance, and surrender behind a config flag.

**The hint system — the headline feature.** Complete basic strategy as three lookup tables (hard
totals, soft totals, pairs) indexed by dealer upcard 2–10/A. The coach:

- shows the recommended action prominently, and outlines that button on the table;
- explains it in plain English — *"Hard 16 against a 10: you're losing either way, but hitting
  loses less often than standing into a made 20"*;
- **respects legality**. If the book says double but you're on three cards, it recommends the
  correct next-best legal action and tells you it did. Same for splits, and same when a rule is
  switched off — surrender is never recommended at a table that doesn't offer it;
- tracks a **running accuracy stat** (how often your action matched the book), persisted in
  `localStorage` across sessions, with a current/best streak;
- has an optional **strict coach** toggle that intercepts a deviation and makes you confirm it.

**Correct money.** Blackjack pays 3:2, 21-after-a-split does not. Pushes return the stake,
insurance pays 2:1 and is settled before the hand, doubles and splits stake correctly, and
surrender returns half.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173/nick-poker-bj/
npm test           # 116 unit tests on the engine
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ locally (this is where the service worker is live)
```

`npm run icons` regenerates the PWA icon PNGs from `scripts/generate-icons.mjs` (dependency-free —
it writes the PNGs by hand). You only need this if you change the artwork.

> The dev server does **not** register the service worker. To test offline behaviour, use
> `npm run build && npm run preview`.

---

## Getting it onto an iPhone

**It's live:** <https://nirvair-sangha.github.io/nick-poker-bj/>

The repo is public and GitHub Pages is enabled with **Source: GitHub Actions**, so every push to
`main` builds, tests and redeploys automatically. Nothing further to set up.

### Install it

1. Open <https://nirvair-sangha.github.io/nick-poker-bj/> in **Safari** on the iPhone — it must be
   Safari, Chrome on iOS can't install PWAs.
2. Tap the **Share** button (the square with the arrow).
3. Scroll down, tap **Add to Home Screen**, then **Add**.
4. Launch it from the home screen. It opens full-screen with no browser chrome.
5. That first load precaches everything. After that it works with no signal at all — airplane mode,
   the Tube, a basement, wherever.

To update it later, just open it once with signal; the service worker picks up the new build and
swaps it in on the next launch.

### If you ever want to move it

The deploy job checks whether Pages is enabled and **skips cleanly rather than failing** if it
isn't — so the workflow keeps working if the repo goes private again (though Pages itself would
then need a paid plan).

- **Netlify / Cloudflare Pages** — free tiers, and they'll build from a private repo. Build command
  `npm run build`, publish directory `dist`. Change `base` in `vite.config.ts` from
  `'/nick-poker-bj/'` to `'/'` first, since they serve from the domain root — otherwise every asset
  404s.
- **Same Wi-Fi, no deploy** — `npm run build && npm run preview -- --host`, then open the printed
  `Network:` URL from the phone. Useful for testing a change before pushing, but note that **iOS
  only registers service workers over HTTPS or on `localhost`**, so a plain-HTTP LAN address will
  install and play but won't precache — it isn't genuinely offline.

> A Pages site is served publicly regardless of repo visibility; private-repo Pages keeps the
> *source* private, not the site, unless you're on Enterprise with access control.

---

## Offline behaviour

`vite-plugin-pwa` runs in `generateSW` mode with `registerType: 'autoUpdate'`. Every build asset —
JS, CSS, HTML, icons, manifest — is precached by Workbox, and navigations fall back to the
precached `index.html`. Once the app has loaded a single time it never touches the network again.

State lives entirely in `localStorage`: bankroll, lifetime hands, net chips, coach accuracy and
streaks, and your hints/strict-coach preferences. There is no account and nothing leaves the phone.

When you push a new version, the service worker picks it up and swaps it in on the next launch.

---

## Rule defaults

All of these live in `src/engine/blackjack/rules.ts` and are configurable; the defaults are a
standard multi-deck shoe game.

| Rule | Default |
| --- | --- |
| Decks | 6 |
| Shuffle point | 75% penetration |
| Dealer on soft 17 | Stands (S17) |
| Blackjack pays | 3:2 |
| Double | Any first two cards |
| Double after split | Allowed |
| Split to | 4 hands |
| Split aces | One card each, no re-split |
| Surrender | Off (late surrender implemented behind the flag) |
| Insurance | Offered on a dealer ace |
| Dealer peek | On |
| Table limits | 5 – 500 |
| Starting bankroll | 1000 |

The strategy tables are the multi-deck S17 + DAS charts. Flipping `dealerHitsSoft17` applies the
standard H17 deviations on lookup (11 vs A becomes a double, 15 and 17 vs A become surrenders where
allowed, soft 18 vs 2 and soft 19 vs 6 become doubles, 8,8 vs A becomes a surrender), so there's a
single source of truth rather than a second hand-maintained chart.

Tap the **ⓘ** in the top-right of the table to see the active rules in-app.

---

## Architecture

There's a hard wall between the engine and the UI. Nothing in `src/engine/**` imports React or
touches the DOM, so it's unit-testable in a plain Node environment and reusable if this ever gets
wrapped natively.

```
src/
  engine/
    cards.ts                 Card/Rank/Suit, deck + shoe construction, crypto-seeded shuffle
    blackjack/
      rules.ts               configurable rule set + defaults
      hand.ts                hand valuation (soft/hard aces), pairs, blackjacks
      game.ts                the immutable state machine and all settlement math
      strategy.ts            the three basic-strategy tables + legality-aware advice
  ui/
    Home.tsx                 game picker
    stats.ts, storage.ts     localStorage persistence
    blackjack/               table screen, cards, chips, coach panel
```

The engine is **immutable throughout** — the shoe included. `draw(shoe)` returns
`{ card, shoe }` rather than mutating, and every action returns a fresh `GameState`, which means
game state can live directly in React `useState` with no defensive copying.

### Tests

116 Vitest tests over the engine:

- hand valuation, including multi-ace hands and soft→hard demotion;
- dealer play under S17 and H17;
- payout and settlement math, pushes, insurance, surrender, blackjack vs 21-after-split;
- split handling, re-split caps, DAS, split-ace locking;
- and a broad spread of strategy lookups, including 16v10, A7 vs 2/7/9, 12 vs 2/3 vs 4, 8,8 always
  splits, 10,10 never splits, and A,A always splits (and hits when splitting isn't available).

Tests deal from a **stacked shoe** helper, so every scenario is deterministic. Deal order is
player, dealer, player, dealer.

---

## What's next

- **Video Poker** — Jacks or Better with an optimal-hold evaluator.
- **Texas Hold'em** — heads-up against the house with pot-odds coaching.
- Shoe-aware extras for blackjack: running/true count display, deviation drills, and a hand
  history you can review.

---

## Notes

- The service worker only exists in a production build. `npm run dev` won't show install prompts.
- `base` is set to `/nick-poker-bj/` in `vite.config.ts` for GitHub Pages. Change it if you deploy
  elsewhere.
- Splitting deals a card to both new hands immediately rather than completing the first hand first.
  This is a deliberate simplification and doesn't change the odds.
