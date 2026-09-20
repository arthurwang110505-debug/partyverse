# Gameplay implementation — first pass

Date: 2026-09-20. Scope: mobile/navigation, shared lifecycle blockers, Bomb Countdown and Draw & Guess. This is **not** completion of the entire ten-game gameplay roadmap.

## Mobile and navigation

- One **遊戲** and one **加入房間** action in each navigation layout; hero CTAs remain intentional.
- Fluid hero widths, wrapping status rows, safe-area navigation and 44px menu targets. The 320px hero previously measured 349px wide despite the document hiding its overflow.
- Static radial lighting replaces very large filtered backgrounds. Decorative animation, scanlines and backdrop filters are disabled for phone/coarse-pointer landing layouts.
- The sample controller is clearly marked as an illustration, not clickable game controls.
- Firebase/room providers now live under create/join/room layouts; visiting marketing pages does not start authentication, room subscriptions or host clocks.

## Shared lifecycle

- The default host is a **display**, not a playable seat. The host can participate with a separate phone. A phone taking over host ownership keeps its controller.
- Each match freezes `participantIds`. Late joiners spectate until the next lobby/start. Engines and voting/scoreboard views receive only that roster.
- `engine/state.ts` and `lib/roomData.ts` restore arrays/maps omitted by RTDB. Controller dispatch happens before any game-specific state access.
- `lib/gameSession.ts` owns starts, deadline advancement, actions, results, replay and switching games. Actions transact the current **whole room**, reject obsolete match/phase/round contexts, and enforce expiry before applying an answer.
- `phaseEndsAt` uses Firebase's server-time offset when available. Duplicate ticks do not consume extra time. Delayed ticks catch up to the current phase, then give the next reveal its full duration instead of skipping it.
- Host recovery accepts either a disconnected host or a host with a stale heartbeat. Ownership is checked again inside transactions; takeover does not reset a deadline.
- Results → lobby resets scores/readiness without changing the room code or removing players. Every connected screen follows the live room status. Tied winners and cooperative outcomes are explicit.
- Destructive restart/end actions have confirmations. Settings only expose controls that the selected engine uses; Draw rounds mean **turns per player**.
- Demo identities use per-tab `sessionStorage`; same-browser room mutations use Web Locks where supported. The old inert bot-seat button is replaced with a real “open a player tab” link.
- Configured Firebase failures are surfaced instead of silently creating unjoinable local rooms.

## Bomb Countdown

- Short round briefing, shared fuse that does **not** refill on a correct pass, escalating question difficulty, shuffled options and distinct challenge IDs.
- Correct answers earn 10 points; wrong answers reduce the fuse by one second and have a short retry cooldown.
- A visible explosion/reveal phase, shorter later fuses, actual configured rounds, all players returning next round, and cumulative scores. Last survivor earns 50 points; ties are retained.
- Disconnected/eliminated players cannot receive the bomb. Stale challenge taps cannot score twice.

## Draw & Guess

- Shuffled, balanced drawer rotations; each configured round gives every available player a turn. Short briefing, prompt history across rematches, aliases, and difficulty-dependent timed hints.
- Faster correct guesses earn 10–25 points; the drawer earns 5 per correct guess. Successful public guesses say “答對了！” rather than revealing the word.
- Drawing streams during movement (100ms throttle), not just after pointer-up. Stroke IDs/revisions reject older packets; canvas versions prevent cleared/undone strokes from reappearing.
- Pointer capture/cancel handling, bounded coordinates/payloads, no silent removal of older art at the stroke limit, and tools/inputs unavailable outside the drawing phase.
- A disconnected drawer ends the turn cleanly; disconnected guessers do not hold the round open.

## Verification

```sh
npm ci
npm run test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests default to **local demo mode**, not a production database. `PLAYWRIGHT_BASE_URL` can point at an already-running server; optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` supports a preinstalled Chromium. Use a demo/local deployment for these tests.

Recorded result for this pass: **85 unit/regression tests and 32 Chromium browser tests passed**, with clean typecheck/lint and a successful production build. The browser suite was rerun against the optimized production server. These numbers do not include any live Firebase or physical-device test.

Coverage includes:

- Engine rules, malformed actions, omitted collections, late/duplicate ticks and actions, frozen rosters, display-only capacity, results/rematch, ties and host takeover.
- Chromium landing layouts at 320, 360, 390, 430, 844-landscape and 1280px; navigation uniqueness, Escape/focus, and actual touch-event scrolling at 4× CPU throttling.
- All ten host/controller views after simulated RTDB collection elision.
- One TV plus four independently identified same-browser player tabs: concurrent joining, ready, start, voting, refresh, results, replay and game switching.
- Live drawing before pointer-up, masked successful guesses, undo and phase cleanup; late join and stale-host recovery.

## Limits and remaining work

- Chromium mobile emulation is **not** a physical iPhone/Android performance guarantee. Real iOS Safari/WebKit and Android hardware checks remain.
- The RTDB round-trip helper and mocked transaction tests are **not** a Firebase emulator test. Emulator/live database latency, offline/reconnect contention and production security-rule verification remain. This environment could not download browser/emulator binaries from their usual CDNs; Chromium was exercised via an npm-packaged binary instead.
- Demo rooms work only in ordinary tabs in the same browser profile/origin. They cannot be joined from another device or a separate incognito profile. Use Firebase for TV + physical phones.
- Hidden words, answers and roles still exist in the shared room payload. UI concealment is **not security**. Move secrets and score/action authority to trusted backend code with restricted reads before treating this as cheat-resistant multiplayer.
- Whole-room RTDB transactions intentionally favor correctness here. Load-test drawing and high-frequency game modes before larger deployments. Browsers without Web Locks retain best-effort local-demo updates.
- The remaining modes received shared lifecycle/controller fixes, not comprehensive mechanic redesigns. Song audio/content, King timing/fairness, Battle rate authority, Firework rendering, Undercover tie/offline rules, Mystery progression and the other content decks remain follow-up work.
