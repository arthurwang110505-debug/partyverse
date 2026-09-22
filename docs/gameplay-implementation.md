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

Note: the 2026-09-22 pass ran in a network-restricted environment that could not download Chromium, so the browser suite was not executed there; the playthrough harness (`playthrough.test.ts`) covers the same lobby→rounds→results journey at engine level instead.

Recorded result for this pass: **85 unit/regression tests and 32 Chromium browser tests passed**, with clean typecheck/lint and a successful production build. The browser suite was rerun against the optimized production server. These numbers do not include any live Firebase or physical-device test.

Coverage includes:

- Engine rules, malformed actions, omitted collections, late/duplicate ticks and actions, frozen rosters, display-only capacity, results/rematch, ties and host takeover.
- Chromium landing layouts at 320, 360, 390, 430, 844-landscape and 1280px; navigation uniqueness, Escape/focus, and actual touch-event scrolling at 4× CPU throttling.
- All ten host/controller views after simulated RTDB collection elision.
- One TV plus four independently identified same-browser player tabs: concurrent joining, ready, start, voting, refresh, results, replay and game switching.
- Live drawing before pointer-up, masked successful guesses, undo and phase cleanup; late join and stale-host recovery.

## Second pass — all ten games playable (2026-09-22)

Scope: make every registered game fully playable end-to-end (lobby → rounds → results, on both TV and phone) and raise the fun factor. All engines were driven by `src/engine/playthrough.test.ts`, a full-match simulation harness (start → 1s ticks with player actions → results), plus targeted mechanic tests in `src/engine/partyGames.test.ts` and `src/engine/allEngines.test.ts`.

- **誰是臥底** — a tied vote no longer eliminates an arbitrary victim: nobody is removed, the round announces the stalemate and voting resumes. If the last connected seat is the spy (or only civilians are left), the match force-ends immediately instead of deadlocking.
- **炸彈倒數** — the "easy" pool gained a reaction-tap **speed** challenge (one big GO button) alongside reaction and quiz. Wrong-answer fuse penalty and retry cooldown unchanged.
- **煙火大師** — every submitted design is sanitized (`sanitizeDesign`): bad colors/shapes/trails fall back to defaults, finite density clamps to 5–80, non-numbers use the default 30. The show renders trail-aware physics (smoke drifts slowly and fades, glitter twinkles), a labeled parade names each player while their firework is up, and results display each player's actual design card.
- **大家心知肚明** — question deck doubled to 20 items (self-vote remains legal by design).
- **你畫我猜** — already mature; no mechanic changes this pass.
- **大亂鬥** — body checks now knock opponents back (no damage), a 10-point **mega star** spawns every 8 seconds and respawns keep the field stocked, phone input throttles to a 200ms cadence, and the TV canvas interpolates positions so movement looks smooth at 1Hz host ticks.
- **密室推理** — rewritten around a pool of **5 cases** (castle 7657, base 5896, submarine 3962, space 4846, cruiser 6434) with one new case per lobby. A 4-digit lock with per-cell state, wrong codes flash red, shake and shave 3s off the timer (up to 3 hints at −10s each), and the code is masked until solved.
- **AI 瞎扯王** — prompt deck doubled to 24 items.
- **三秒猜歌** — reworked into a lyric-flash game (no audio assets required): a lyric line flashes on the TV, one more character unlocks every 2 seconds, phones race to answer, and the reveal shows the title plus the full lyric. Deck of 12 songs.
- **今晚誰是王** — rapid-tap challenges now batch: phones accumulate taps client-side and flush at most every 400ms, the engine accepts an integer `taps` count (capped at 40 per action), a failed flush requeues the taps, and the TV shows a live tap counter.
- **Shared** — `animate-scale-in` / `animate-shake` keyframes added (both were referenced but never defined, so no entry animation ever fired); per-game WebAudio SFX and haptics on phones; the old "song audio" gap is closed by design (lyric flash instead of a synth clip).

## Limits and remaining work

- Chromium mobile emulation is **not** a physical iPhone/Android performance guarantee. Real iOS Safari/WebKit and Android hardware checks remain.
- The RTDB round-trip helper and mocked transaction tests are **not** a Firebase emulator test. Emulator/live database latency, offline/reconnect contention and production security-rule verification remain. This environment could not download browser/emulator binaries from their usual CDNs; Chromium was exercised via an npm-packaged binary instead.
- Demo rooms work only in ordinary tabs in the same browser profile/origin. They cannot be joined from another device or a separate incognito profile. Use Firebase for TV + physical phones.
- Hidden words, answers and roles still exist in the shared room payload. UI concealment is **not security**. Move secrets and score/action authority to trusted backend code with restricted reads before treating this as cheat-resistant multiplayer.
- Whole-room RTDB transactions intentionally favor correctness here. Load-test drawing and high-frequency game modes before larger deployments. Browsers without Web Locks retain best-effort local-demo updates.
- All ten modes now have the mechanic work listed in the second pass; remaining items are broader than per-game fixes: live-device feel (touch latency, haptics on real phones), larger content decks, richer art, and multi-round campaign structure for the single-round games (single-round is currently by design).
