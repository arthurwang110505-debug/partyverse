# PartyVerse — UI/UX Improvement Plan

Audit date: 2026-09-19 · Branch: `arena/01a0bbdc-partyverse` @ `9235ab8` · Scope: **UI/UX only** — build health, realtime logic and data-layer work were covered in `docs/improvement-plan.md` and are intentionally out of scope here.

Every claim below was verified with a command run against this checkout.

---

## 0. Current state — what's already good

The earlier engineering plan's UX-relevant fixes have landed, visibly:

- Landing is a **server component** with real SSR content, per-game metadata, OG image, sitemap, robots, custom 404/error/loading pages.
- Design tokens exist (`ink`, `ink-raised`, `brand` in Tailwind), plus `.glass*` utilities, global `:focus-visible` rings, `prefers-reduced-motion` handling, themed scrollbar/selection.
- Shared primitives: `Button`/`LinkButton` (no nested-interactive), `Field` (label↔input wiring, `role="alert"` errors), `ErrorNote`.
- Navbar: `aria-expanded`/`aria-controls`, Escape-to-close; lobby uses an inline `alertdialog` instead of `window.confirm()`; join normalizes codes and persists nicknames; host-stale watchdog with a takeover CTA.
- Web-Audio SFX engine (`lib/sound.ts`) + vibration exist for Bomb Countdown; results page has podium, rankings and achievements.

So the site looks good on first load. The remaining work is concentrated in **the in-room experience** — which is where 100% of playtime happens — plus mobile ergonomics, feedback and consistency. The plan below is ordered by how often a user hits the problem.

---

## 1. P0 — The in-room experience is inconsistent across 10 games (~2–3 days)

The bomb game's phone/TV views got a full design treatment. The other 9 games ship bare views that each hand-roll their own header, and share none of it.

**Verified gaps:**

| Gap | Evidence |
|---|---|
| Play views have no shared chrome: no room code, no own avatar/nickname, no score, no timer, no connection state | `PlayRealBattle.tsx` is a bare D-pad; `PlayDrawAndGuess.tsx` guessers see no round/timer on phone |
| Every play view hand-rolls a different colored `uppercase tracking-wider` label | grep of all 9 play views: 9 different one-off headers (orange-400, pink-400, cyan-400…) |
| Errors are **silently swallowed** — a failed write looks identical to success | `catch { // Ignore }` ×14 across all 9 play views; tap → nothing happens → users tap again / think the game froze |
| Zero accessibility markup in all 18 game view files | `grep -c aria-hidden` returns **0** in every `host/views/*` and `play/views/*` file — emoji are announced raw by screen readers, the D-pad `▲▼◀▶` buttons have no accessible names |
| SFX/haptics wired for **1 of 10 games** | `sfx.`/`vibrate` imports: only `HostGameView.tsx` + `PlayGameView.tsx` (the bomb shells). The other 9 host views have no tick, reveal or round-transition sound |
| **No mute control anywhere** | `grep -i mute\|volume src` → 0 hits. `HostGameView` plays a tick on *every* gameState change; the TV version of a party game must have an off switch |

**Fixes:**

1. **Build a shared game UI kit** in `src/components/game/`:
   - `<PlayShell>` — phone-controller chrome: room code, own avatar+nickname, live score, round indicator, and a connection/reconnecting badge — wrapping every `Play*` view. Replaces `PlayWrapper` (currently a bare `<main>`).
   - `<HostShell>` — TV chrome: game accent color, round/timer header, persistent player-connection strip, and the host controls (restart/end) that today are copy-pasted into 9 views.
   - `<RoundTimer>` — number **+ a draining progress bar or ring** (today timers are bare numbers; a visible drain is the single highest-tension, lowest-cost addition to a party game).
   - `<PlayerChip>` / `<ScoreboardList>` — the avatar+score grid is re-implemented in nearly every host view.
2. **One feedback path for actions**: a tiny toast system (or even `ErrorNote` in a fixed bottom slot) used by every `submitAction` call site. Rule: **no silent `catch { // Ignore }`** — show "送出失敗，請再試一次".
3. **Audio pass**: fire `sfx` on vote-received / reveal / round-start / timer-critical in all games; add a 🔊/🔇 toggle persisted in `localStorage`, placed on the host shell (TV) and the join form. Respect `prefers-reduced-motion`'s spirit: sound shouldn't fire without a user gesture (already partially true via AudioContext, formalize it).
4. Kill the remaining visual split-personality: `HostLobbyClient`'s start button uses an inline `linear-gradient(#22c55e…)` style and `CreateRoomClient`/`GameDetailPage` pass `style={{ background: game.gradient }}` — introduce a **game-accent CSS variable** (`--game-accent` set on the shell, consumed via `bg-[color:var(--game-accent)]` / arbitrary-value tokens) so one mechanism themes all of: lobby code color, card CTA, create button, start button, timer color.

**Acceptance:** play two different games on a phone + TV. Both show identical chrome (room/self/score/round), both tick and reveal with sound, both have a mute toggle that works, and a failed action shows an error everywhere.

---

## 2. P0 — Mobile-controller ergonomics (~1 day)

The phone view *is* the product and it currently fights the phone:

| Gap | Evidence |
|---|---|
| `viewportFit: "cover"` is set (viewport.ts) but **no `env(safe-area-inset-*)` used anywhere** | `grep env(safe` → 0. The `fixed bottom-4` score pill in `PlayGameView` and every absolute overlay will sit under the iPhone home indicator / over the notch |
| No `touch-action: manipulation` / `-webkit-tap-highlight-color` | `grep` → 0. Rapid-tap buttons (RealBattle D-pad) hit double-tap zoom on iOS Safari and flash grey highlights on Android |
| No `overscroll-behavior` guard | Pull-to-refresh mid-round reloads the page; there's session restore, but the round moment is lost |
| `min-h-screen` instead of `100dvh` | `grep dvh` → 0. On mobile Safari the "bottom" content hides under the collapsing URL bar |
| RealBattle D-pad = discrete taps, ▲ glyphs, no labels | One move per tap with no press-and-hold, and buttons a screen reader names "upwards black arrow" |

**Fixes (mostly a few lines in `globals.css` + shells):**

```css
body { -webkit-tap-highlight-color: transparent; }
button, a { touch-action: manipulation; }          /* kill double-tap zoom delay */
.player-shell { overscroll-behavior: contain; }    /* no pull-to-refresh in-room */
.dock { padding-bottom: max(1rem, env(safe-area-inset-bottom)); /* score pill, D-pad */ }
```

- Use `min-h-[100dvh]` for the phone views; keep `min-h-screen` for marketing pages.
- RealBattle: press-and-hold to repeat (or swipe-to-move), real `aria-label`s （上/下/左/右）, and haptic `vibrate(8)` per move.
- Prevent accidental navigation: `beforeunload` warning isn't welcome on the TV, but the **back button / swipe-back on the phone** should confirm before `leaveRoom()` — today one accidental swipe silently drops the player.

**Acceptance:** on an iPhone 14 Pro (notch + home bar): nothing clipped, no tap zoom, no grey flash, pull-to-refresh doesn't fire, back-swipe asks "離開房間？".

---

## 3. P1 — Global navigation + page architecture (~1 day)

**Verified:** `<Navbar />` is rendered in exactly **one file** — the landing page (`grep Navbar src/app` → 1 hit). `/games`, `/games/[game]`, `/join`, `/create/[game]` offer only back-links or nothing. From `/games` there is no way home except the back button.

- Extract a shared page chrome for non-room routes: Navbar + consistent `pt` offset + footer (the landing footer is duplicated nowhere else). Keep it *out* of `/room/**` — in-room is fullscreen by design.
- Landing now contains **two near-duplicate catalog sections** (「精選遊戲」 grid + 「全部遊戲」 grid repeating the same cards): replace 全部遊戲 with a compact category/tag strip linking into `/games`, cutting ~200px of scroll and one full re-render of the same `GameCard`s.
- Navbar CTA 「開始遊戲」 → deep-link to `/games#playable` (or open a "pick a game" sheet); today it's two clicks to create a room.
- `/games` filter UX: `AnimatePresence mode="wait"` keys the **entire grid** on filter+search, so every keystroke fades out the whole page and fades it back in (a 150ms-debounced full-page flicker). Switch to per-card fade or `layout` animation; and add the debounce indicator — right now typing feels broken because results only update after a pause with no visible pending state.
- Add a **「最近加入的房間」** row on `/join` from `localStorage` (code + nickname + timestamp, one-tap rejoin). This is the recovery path for every accidental refresh/exit, and for a party game, rejoins are constant.

---

## 4. P1 — Lobby: the conversion moment on the TV (~1 day)

The lobby is the room's front door; every player sees the TV here first.

- **QR is 160px** on the lobby card, with the big version hidden behind a button. TVs are viewed from 2–3 meters: make the QR ≥ 240px by default (or scale to viewport), keep fullscreen mode, and **show the human-typable join URL** (`partyverse.app/join/ABCDE`) next to the QR for people whose camera fails — the URL exists but is never displayed anywhere.
- 「複製代碼」 copies 5 characters. Add **「複製邀請連結」** (the full URL) — sharing to a chat group is how rooms actually fill when not everyone sees the TV.
- **Join chime**: play a soft `sfx.playSuccess()` on the TV when a player joins, plus a slide-in animation on the player list. This is the Jackbox delight loop and it also *confirms* the QR scan worked — today a join is silent and visually identical to a re-render.
- Empty state is a single line 「還沒有玩家」. Add a small "1 → 2 → 3 開始" journey hint under the QR (host's *next* action is unclear until players arrive).
- Player rows: the offline dot + kick X are fine, but `$1 人後才能開始` logic deserves a progress visual: `●●○○` (2/4 位玩家）, and the start button should explain itself when disabled (the text below does this — move it into a tooltip/`aria-describedby` on the button so it's discoverable where the cursor is).

---

## 5. P1 — Results & endgame (~0.5–1 day)

- Podium + achievements exist, but the moment is flat: add a **confetti/celebration burst** (canvas-confetti, ~6kB) on mount and a score-count-up animation on podiums (both gated by `prefers-reduced-motion`).
- Add a **round recap** strip (per-round leader / biggest comeback) — the data is already in `currentScores` per round in several engines; an end-of-night "fun fact" is what people screenshot and share.
- **Non-hosts are stranded**: their only action is 「返回首頁」 while the host gets 再玩一次. When the host restarts, `RoomGate` will redirect players — but until then the results screen should say 「等待房主決定下一局…」 with a live pulse, so 19 people aren't silently wondering whether to leave.
- 「結束並解散房間」 uses `window.location.assign("/")` — replace with `router.push` and the same confirm dialog pattern as the lobby.

---

## 6. P2 — Accessibility pass on the 18 game views (~1 day)

The shared shell work in §1 fixes half of this by centralizing; the rest is a targeted sweep:

- All decorative emoji/icons: `aria-hidden="true"`; D-pad and icon-only buttons: `aria-label`.
- **Timers**: host countdowns can't be `aria-live="polite"` (would announce every second) — pattern: keep visual as-is, add an `sr-only` `role="status"` companion that announces at 10s/5s/0s and on phase changes ("投票時間到，正在揭曉").
- Voting/answer buttons need `aria-pressed` / selected state and a visible "已送出 ✓" state — today only some views show one.
- Contrast sweep: `text-white/30`/`text-white/25` body text on `#050508` is below 4.5:1 (footer 「© PartyVerse」, empty-state hints). Floor body copy at `white/50`.
- Verify the whole lobby→game→results loop with keyboard only and with VoiceOver once — the timer/vote announcements are the risky part.

---

## 7. P2 — Component maturity (~1–2 days, can ride along with §1)

- Extract a real **`<Modal>`** primitive (portal, focus trap, backdrop click, Escape): `HostLobbyClient` alone hand-rolls 3 overlays and the pattern will repeat (kick confirmation, leave confirmation, mute/settings sheet).
- Extend `Button` with the missing semantic slots so inline styles die: `variant="accent"` + the `--game-accent` var from §1, `loading` prop (today `submitting` states re-implement spinners as `animate-pulse` text in 3 places), and an `iconOnly` shape (the kick X, mute toggle) that bakes in the size + label requirements.
- `GameCard`: unify the "game color" treatment — category colors map is `PARTY: pink...` while the card uses per-game `game.color` for icon/CTA; pick one source of truth so a game reads the same color in card, lobby, timer and results (currently bomb is red in cards but violet in the holder chip).
- Micro-motion pass with the existing framer-motion dependency, all under `prefers-reduced-motion`: player-join slide, score-change tick (`+5` float), holder-swap flash, vote bar grow on reveal. These are the moments that make a party game feel alive; today only the bomb flash and one `animate-bounce` exist.

---

## 8. Roadmap

| Phase | Scope | Effort | Exit criterion |
|---|---|---|---|
| **P0-a** | Game UI kit: `PlayShell`/`HostShell`/`RoundTimer`/`PlayerChip`, toast feedback, no silent catches | ~2–3 d | All 10 games share chrome; every failed action shows an error |
| **P0-b** | Sound coverage for all games + mute toggle + game-accent CSS var | ~1 d | Tick/reveal audible everywhere, mutable in one tap |
| **P0-c** | Mobile: safe-area, touch-action, tap-highlight, overscroll, dvh, back-swipe guard, RealBattle hold-to-move | ~1 d | iPhone/Android: no clipping, no zoom-flash, no accidental exits |
| **P1-a** | Global chrome + landing de-dupe + `/games` grid animation fix + recent-rooms rejoin | ~1 d | Every non-room page has nav; one-tap rejoin |
| **P1-b** | Lobby: big QR + join URL + invite link + join chime + start-progress | ~1 d | A stranger can join without touching the host's phone |
| **P1-c** | Results: confetti, count-up, round recap, non-host waiting state | ~0.5–1 d | End-of-game is a moment, not a page |
| **P2-a** | A11y sweep of 18 views + contrast + keyboard/VoiceOver run | ~1 d | axe: 0 critical/serious in-room |
| **P2-b** | Modal/Button/GameCard maturity + micro-motion | ~1–2 d | No hand-rolled overlays or inline game-gradient styles left |

**Do first:** P0-a. The kit is the multiplier — it makes every later improvement (SFX, mute, a11y, motion) land once instead of ten times, and it's the difference players actually feel between "10 games" and "1 game reskinned 9 times".
