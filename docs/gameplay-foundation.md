# Gameplay foundation — 2026-09-23

This delivers the first slice of the gameplay improvement roadmap, not the entire roadmap.

## Shipped

### Shared onboarding and feedback (all 15 games)

- Every registered game now opens with the same goal / controls / scoring briefing. Traditional Chinese copy lives in `src/constants/gameGuides.ts`.
- Reading is not timed. Each connected match participant confirms readiness on their phone; everyone ready starts play. Only the current connected host can bypass readiness. Readiness survives refresh and resets on restart/rematch.
- Display seats and late spectators do not count toward readiness. A disconnected unready player does not block the remaining ready participants. Host recovery continues to work from a phone.
- Game state is freshly initialized when the briefing ends so song/reaction clocks do not run out during reading. Bomb Countdown's separate fuse is not used as the briefing timer.
- TV and phone shells provide an expandable controls/scoring reminder during play.
- Submission progress and personal acknowledgement cover social voting, bluff writing/voting, firework design/voting, lyric answers, Undercover voting, and Word Chain voting. Counts exclude disconnected/nonparticipating/ineligible players and never display their answer choices.

### Poker Lite correctness

- Posted blinds establish the opening bet and amounts owed. Heads-up dealer posts the small blind and acts first preflop; postflop starts to the dealer's left.
- Turn order continues clockwise after a fold.
- Side pots include folded players' contributions but exclude them from winning. Unmatched excess is returned; ties conserve chips, with odd chips allocated clockwise from the dealer.
- Raises cannot create chips. Minimum raises use the previous full raise size. Short all-ins require opponents to match the increase without incorrectly reopening raising for players who already acted.
- All-in hands run out the board before evaluation.
- Each decision has its own deadline. Browser actions carry a decision context to reject delayed/duplicate taps from an older decision.
- Intentional rule change: a timeout **folds when facing a bet, checks otherwise** instead of automatically spending chips. Guide, settings text, catalog copy, and controller timer reflect this.
- Phone raise buttons show only affordable, legal options; waiting copy names the active player. Settlement copy distinguishes chips received (which can include refunds) from net winnings.

### Word Chain correctness and pacing

- Both engine and phone validate links against the pending word's tail when one exists. Duplicate and malformed words are rejected consistently.
- Joining an objection no longer clears votes, restarts the voting timer, or overwrites the saved round clock.
- Votes require booleans and cannot be changed after submission. Disconnected voters do not hold a completed vote open.
- Accepted and rejected votes resume the saved round time. Rejected words leave the chain history; ties retain the word.
- Every round reaches its reveal, including empty rounds and rounds with already-confirmed words. Next round starts with a new seed; idle matches finish rather than looping indefinitely.
- Objection windows follow elapsed round time; repeated actions/host ticks cannot consume them prematurely.
- Both screens explain confirmed/rejected word scoring. Pending submissions are no longer mislabeled as already earning points. The final round announces final results, not another round.

## Verification performed

- `npm run test`: **186 tests passed**, including all-15-game playthroughs and new poker, Word Chain, briefing, and feedback regressions.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- Production-server Playwright run: **57 tests passed**. Includes all 15 host/controller views, all 15 phone briefings at 320px, one TV + four independent local player tabs, readiness persistence through refresh, host early start, rematch/switch, drawing, and stale-host recovery.
- Updated the landing touch test's obsolete no-animation/no-blur assertion to match the documented 2026-09-22 decision to retain mobile animations. The real throttled touch-scroll/menu-navigation checks remain; no landing implementation changed.

The standard Playwright browser download failed in this environment. The browser run used npm-packaged `@sparticuz/chromium` 153 in ignored scratch storage, its bundled Linux libraries, and the existing executable-path override. No browser tooling dependency or binary was added to the project.

## Remaining milestones / limits

- Practice interactions; Quick/Standard/Relaxed presets and settings-aware duration estimates.
- Broader content correctness review (especially song metadata and uniquely solvable mystery clues), more decks, and flagship-game depth/replay work.
- Real Battle movement authority and high-frequency transport/load testing.
- Additional spectator activities, detailed per-round score breakdowns beyond the updated games, next-game voting, and party playlists.
- Firebase emulator/security-rule verification, physical iOS/Android devices, and actual TV-plus-phone network latency testing. Local tab tests do not substitute for these.
- **Secrets still reside in the shared room payload and game authority is client-side.** This work does not make multiplayer cheat-resistant. Private data and trusted backend validation remain a separate required production milestone.
- `npm ci` reported 20 dependency audit findings (12 moderate, 6 high, 2 critical). Dependencies were not upgraded as part of this gameplay slice; triage and framework/security updates remain necessary before a production release.

For the live preview without Firebase, use the lobby's **開新分頁當玩家** link in the same browser/profile. Physical phones require configured Firebase.
