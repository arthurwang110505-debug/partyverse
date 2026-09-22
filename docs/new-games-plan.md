# Plan — adding five more party games (2026-09-22)

Status: **planning only**, nothing implemented yet. Owner approved the direction on 2026-09-22; open questions in §6 need answers before build.

## 1. Design constraints (platform contract)

Every new game must follow the existing ten-game architecture:

- **TV is display, phones are controllers.** All interactivity lives in the `Play*` view; the `Host*` view is a large readable display.
- **Engine** (`src/engine/<id>.ts`): pure functions `createGame(room)`, `updateGameState(room)` (1 host tick/sec), `handlePlayerAction(room, playerId, action)`, `endGame(room)`. State must survive RTDB's empty-collection elision (no `undefined`, empty arrays/objects normalized by `engine/state.ts`). Only the frozen `participantIds` roster is counted — never the `tv` seat.
- **Registry**: one entry in `src/constants/games.ts` (id, name, icon, description) and one settings profile in `src/constants/gameSettings.ts` (timer, rounds, `hasTimer`, difficulty where relevant).
- **Views**: `Host<X>.tsx` + `Play<X>.tsx`, registered in the `VIEWS` maps of `HostGameView.tsx` / `PlayGameView.tsx`.
- **Feel**: WebAudio sfx from `@/lib/sound` (no audio assets), `vibrate()` haptics, `animate-scale-in`/`animate-shake` for feedback, live leaderboard, `再玩一次` / `結束並結算` flow from the shared results shell.
- **Testing**: `allEngines.test.ts` (malformed actions + RTDB round trip), a full match drive in `playthrough.test.ts` (lobby → rounds → RESULTS with score assertions), and targeted mechanic tests. Playwright render-after-roundtrip tests pick new `gameId`s up automatically.
- **No external assets, no network calls, no AI APIs.** Everything deterministically derivable from room state.
- **4+ players minimum** (room minimum), everyone plays at the same time — no hot-seat turns.

## 2. The five games

### G1 · 音樂椅 Musical Chairs — id `musicalchairs`

| | |
|---|---|
| Genre | Reaction elimination, everyone at once |
| Players | 4–10 |
| Settings | no user timer; rounds computed until 2 remain + final |

**Loop.** `briefing` → per round: `music` (5–12s, random) → `sit` (2.5s) → `round_reveal` → repeat → `final` (1 chair) → `result`.

- **Music phase**: TV shows `survivors − 1` glowing chair icons pulsing in a circle. WebAudio metronome accelerates from ~300ms to ~120ms per beat (pure oscillator, no asset). Random duration stored in state so the tick is server-authoritative.
- **Sit phase**: every survivor taps **坐下** once. Taps recorded with their transaction `now`. The last tapper gets no chair and is eliminated; non-tappers auto-eliminate at the 2.5s deadline. Ties inside the same 100ms window: random seat assignment among the tied group (the chair grab is a party lottery by design).
- **Scoring**: +10 per round survived, final survivor +50. Eliminated players keep their points on the scoreboard (bomb-countdown-style), final result ranked by points with the last survivor explicitly crowned.
- **Fun levers**: accelerating beat, chair grid lighting up in tap order, big "站著！💀" stamp for the loser of each round, confetti on the final.
- **Edge cases**: mid-music disconnect → eliminated at round end; everyone disconnected → end match with current scores; rejoin mid-match → spectate until next rematch (shared lifecycle already does this).

**Why first**: smallest engine, biggest laugh-per-minute ratio; reuses the reaction + elimination patterns already proven in bomb/knight.

### G2 · 敲木頭 Whack-a-Mole Whack — id `whackmoles`

| | |
|---|---|
| Genre | Action, tap accuracy, everyone at once |
| Players | 4–10 |
| Settings | 3 rounds × 25s (round lengths 30/25/20s), fixed 3×3 grid |

**Loop.** Per round: `round_intro` (2s) → `hunting` (timer) → `round_reveal` (leaderboard) → next round → `result`.

- **TV**: 3×3 grid of holes; a mole (🐹) pops into a random cell for a visible window, then retracts. Spawn interval shrinks per round (1.1s → 0.7s), window shrinks (900ms → 600ms).
- **Authority model**: at round start the engine pre-generates the whole spawn schedule (seeded RNG, stored as `[{cell, startTick, endTick}]` in state) and reveals it over time. A phone tap is a hit iff its `now` falls inside a schedule entry's window for that cell — pure state check, no host race, replayable in tests.
- **Phone**: the same 3×3 grid of big buttons (mirrored layout, so muscle memory transfers).
- **Scoring**: +1 per hit; one hit consumed per mole; tapping an empty cell counts as a miss (no penalty, shown as a precision stat); streak of 5 consecutive hits → +5 combo bonus. 3 rounds cumulative.
- **Fun levers**: `playPop` per hit, TV combo text pops, round-end podium with precision %.
- **Edge cases**: late taps after a window closed → miss; tap flooding is harmless; state size bounded (≤ ~40 schedule entries/round, regenerated per round).

### G3 · 西蒙說 Simon Says — id `simonsays`

| | |
|---|---|
| Genre | Memory, everyone at once, no elimination between rounds |
| Players | 4–10 |
| Settings | 3 rounds per match; sequence starts at 3, +1 per level, cap 12 |

**Loop.** Per round: levels of `learning` (TV flashes sequence) → `repeat` (phones tap it back) → … until everyone misses or cap reached → `round_reveal` → next round → `result`.

- **Learning**: TV flashes 4 quadrant tiles (cyan / pink / amber / emerald) in sequence, 800ms on / 400ms off, one WebAudio tone per quadrant. Sequence derived deterministically from a `seqSeed` in state — every client can render the same pattern from state alone.
- **Repeat**: phones show 4 large quadrant buttons. Correct full sequence → player levels up (+level points, new longer sequence from the seed). One wrong tap → player out for this round (miss stamp, keeps score), round continues. Per-player `progressIndex` in state so a reconnecting player resumes mid-sequence.
- **Scoring**: +level per completed sequence; cumulative over the 3 rounds; result ranks by points and shows each player's max level.
- **Fun levers**: the learning flash is the centerpiece (big glowing quadrants + tones), live per-player level bars on the TV, "全對！" burst when someone levels up.
- **Edge cases**: taps during `learning` ignored (phase-validated); taps after being out ignored; everyone out early → short `round_reveal` advances the round.

### G4 · 文字接龍 Word Chain — id `wordchain`

| | |
|---|---|
| Genre | Language + social objection, everyone at once |
| Players | 4+ |
| Settings | 5 rounds × 20s default |

**Loop.** Each round: a **chain head** word is shown on the TV. All phones submit a 2–4 character word that starts with the head's last character. First valid submission (by transaction receipt) becomes the new head and starts a fresh timer.

- **Validation (offline, no dictionary)**: NFKC-normalized, 2–4 CJK characters, starts with the required character, not already in the chain, no digits/punctuation/emoji. What the engine *cannot* judge — is it a real word? — is judged by the room, which is the fun:
- **異議 (objection)**: within 5s of a new head appearing, any other player may object. The room then votes 有效 / 無效 (3s). Majority invalid → word rejected, submitter −5, objector +5, previous head stays; majority valid → nothing changes. No-dictionary validity by crowd adjudication, same social spine as AI 瞎扯王.
- **Timeout**: 20s with no submission → the engine advances the head to the next word from a seeded starter deck (~60 common 2-char words, e.g. 開心→心中→中心…), no points. The deck only seeds; play is open-ended.
- **Actions**: `{type:"submitWord", word}`, `{type:"object", targetWordId}`, `{type:"voteWord", valid:boolean}`.
- **Scoring**: first valid +10, successful objection +5, rejected submission −5. Round ends on timer; result by totals.
- **Fun levers**: buzzer on first-valid, TV chain ribbon (scrolling word chain), objection drum sfx, "全場舉手" vote split shown live.
- **Edge cases**: duplicated concurrent submissions → only the first transaction wins (existing `applyRoomAction` ordering); objection window closes when the next head lands; disconnected submitters' pending words voided; pure-emoji or CJK-mixed garbage rejected client-side *and* engine-side.

### G5 · 快速撲克 Quick Poker (hold'em lite) — id `pokerlite`

| | |
|---|---|
| Genre | Strategy / bluffing, everyone at once |
| Players | 4–10 |
| Settings | 5 hands default, 15s per betting decision (auto-check on timeout), 100 starting chips |

**Loop.** Per hand: `dealing` (hole cards on phone only) → `preflop` (blinds 1/2, rotating) → `flop` (3 community cards on TV) → `turn` → `river` → `showdown` (hands revealed on TV, best wins) → chips carry to the next hand. Match ends after N hands; most chips wins.

- **Betting actions** per player per street: `fold` / `check` / `call` / `raise` (min raise = 1 big blind, all-in allowed). A player who is all-in just stops acting (no further raises) — standard.
- **Side pots**: implemented properly (group all-in levels, award each pot to the best eligible hand). ~30 lines of deterministic logic, keeps the game fair instead of "highest hand takes everything."
- **Evaluator**: standard 5-card ranks from C(7,5)=21 combos, compact table-driven implementation, unit-tested against known hands (royal flush, wheel, quads, kicker cases).
- **TV**: community cards, pot size, per-player "in X chips", live hand names at showdown ("兩對！Q 與 7").
- **Phone**: your two cards + stack + the four action buttons with dynamic labels (跟注 5 / 加注 5+ / 過牌 / 棄牌).
- **Fun levers**: pot fanfare when it passes 50, "大底鍋" banner, showdown reveal staggered per player, chip count-up animation.
- **Edge cases**: single non-folded player left → hand ends, they take the pot, no showdown; timeout auto-check (or auto-fold on preflop if behind) keeps pace; head-up blind rotation (dealer posts both); disconnected mid-hand → auto-fold at their decision deadline.
- **Scope note**: this is the only "big" game of the five (evaluator + side pots + blinds). If the owner prefers a leaner v1, fallback rule: all players rebuy to 100 chips when busted and no side pots (main pot to best hand of all still-in players) — flagged as **question Q2** below.

## 3. Shared integration checklist (per game, same file set as the existing ten)

1. `src/constants/games.ts` — registry entry (name, icon, tagline)
2. `src/constants/gameSettings.ts` — settings profile
3. `src/engine/<id>.ts` — engine + state types (+ content deck for G4, hand evaluator for G5 as sibling modules)
4. `src/engine/index.ts` — registration
5. `src/app/room/[roomCode]/host/views/Host<X>.tsx` + `play/views/Play<X>.tsx`
6. `HostGameView.tsx` / `PlayGameView.tsx` — `VIEWS` map entries
7. `@/lib/sound` hooks (new tones may be added to the existing synth — still asset-free)
8. Tests: `allEngines.test.ts` entry, `playthrough.test.ts` drive, targeted tests in `partyGames.test.ts` (or `pokerLite.test.ts` / `wordChain.test.ts` for the complex rules)
9. Docs: per-game section in `gameplay-implementation.md`; **landing copy "一間房，十款遊戲" → "十五款遊戲" only after all five land** (owner's page, confirmed separately)

## 4. Order and milestones

| Milestone | Games | Why this order |
|---|---|---|
| M1 | G1 音樂椅, G2 敲木頭 | Smallest engines, instant party value; validates the new sfx/animation patterns |
| M2 | G3 西蒙說, G4 文字接龍 | Medium complexity (deterministic sequences, social voting) |
| M3 | G5 快速撲克 | Biggest scope, builds on everything proven in M1–M2; can slip without blocking |

Each milestone ends with: full test suite green (playthroughs included), typecheck/lint/build clean, landing still untouched.

## 5. Verification plan

- **Engine level**: 5 new full-match playthroughs (lobby → every phase → RESULTS with score assertions), malformed-action fuzz in `allEngines`, targeted rules tests (side pots, objections, tap-order ties, sequence determinism).
- **Browser level**: e2e render-after-roundtrip tests cover the new ids automatically; the one-TV + four-phones flow spec gains one scenario per game. (Still blocked in this sandbox — run wherever Chromium can be downloaded.)
- **Performance**: state payloads stay small (schedule ≤ 40 entries, chain ≤ rounds×1 words, deck seeded); poker cards are 20×5-bit, negligible.
- **Manual feel pass** with 4+ real phone tabs in local demo mode per game.

## 6. Open questions for the owner

- **Q1 · Names**: proposed 音樂椅 / 敲木頭 / 西蒙說 / 文字接龍 / 快速撲克 — keep, or rename? (Icons: 🪑 🔨 🔷 🀄 🃏)
- **Q2 · Poker scope**: full side pots (fair, ~1 day of extra work) or the lean "no side pots, busted players rebuy" v1?
- **Q3 · 文字接龍 異議**: keep the crowd-objection mechanic (richer, more shouting) or plain first-valid-wins (simpler, no voting)?
- **Q4 · 音樂椅 audio**: WebAudio metronome/8-note loop only (asset-free), or is a short real music clip acceptable for the dance phase?
- **Q5 · Difficulty settings**: all five use fixed pacing, or should each expose an easy/hard toggle like bomb countdown (e.g. faster spawn / shorter windows)?

Answer any of these and the matching milestone can start.
