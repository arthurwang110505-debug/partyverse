# Phone-host mode — implementation plan (2026-10-23)

**Goal:** run a complete party with **no TV, projector, tablet or computer**. Any
participant's phone can host the room, show the "stage" (what the TV shows
today), invite the rest of the group, and — if they want — play in the same
phone without ever leaving the room.

Today PartyVerse assumes `host = display`. This plan keeps that as the default
and adds an explicit **手機主持 (phone host)** mode.

---

## 1. What actually breaks today

| Assumption in the code | Where | Consequence on a phone-only party |
|---|---|---|
| The host is not a participant (`role: "display"`) | `providers/RoomContext.tsx` (`createRoom`), `engine/participants.ts` | Host can never score, take a turn, or vote. With 2-player games you need 2 extra phones. |
| The host device is a big screen | `components/game/HostShell.tsx`, all 16 `host/views/*` | Layouts are tuned for ≥ 1280px (huge type, wide grids, generous padding). Usable at 390px but not tuned. |
| Host screen and player screen are different routes | `/room/<code>/host` vs `/play`, `host/HostPage.tsx` | A phone host has nowhere to see the stage *and* their own controller. |
| Lobby shows a 280px QR and "電視不占玩家名額" | `host/HostLobbyClient.tsx` | Wrong copy, and the only invite path is "point another phone's camera at my screen" — on a phone the link/share button matters more. |
| Copy everywhere says 電視/大螢幕 | landing, create, play views | Confusing in phone-only play. |

Two fairness details matter:

- `host/views/HostUndercover.tsx` and `HostDrawAndGuess.tsx` hydrate
  `privateHost` through `useGameViewState`. Secrets only render at
  reveal/result today, so making the host a participant does not leak roles
  earlier — but the new mode must keep that invariant.
- The host tab is also the game clock (1s tick loop). The stage/controller
  switcher must stay inside the same tab; never open a second tab for the
  host's own controller.

---

## 2. Product design

### 2.1 Choosing the mode (create time)

Two host-device cards on **both** create flows (`/create/<game>` and
`/random`), persisted in `localStorage` so the choice is remembered:

- **📺 大螢幕主持** (default, today's behaviour) — host device is a
  display-only screen, not counted as a player.
- **📱 手機主持** — the host phone is the stage. A sub-toggle **「我也要一起玩」**
  (default **on**) makes the host a normal participant.

Default can be pre-selected to 手機主持 when
`window.matchMedia("(max-width: 767px)")` matches and the device is not a
tablet-sized browser — a hint, never a hard rule.

### 2.2 Host phone during the lobby

Reuse `HostLobbyClient` with a `phone` presentation:

- Heading 「手機主持」 + one line: 「這支手機就是全場的主持畫面，不用電視。」
- QR at ~200px **plus** a prominent **分享邀請** button
  (`navigator.share` when available, otherwise copy-link — phones almost always
  have share) and the room code.
- If the host plays: a 「我也準備好了」 toggle (host is a participant now, so
  the ready count must include them) and the player list shows the host as
  「房主 · 參賽」.
- Start button stays; the "人數" meter counts the host.

### 2.3 Host phone during play — stage + controller in one tab

New `PhoneHostGameView` (only used when `hostMode === "phone"`):

```
┌───────────────────────────────┐
│ 🎮 房間 ABCDE   [🔊]   · 主持中 │ ← unified slim chrome
├───────────────────────────────┤
│                               │
│   STAGE  (HostGameView)  or   │ ← same height, scrollable
│   CONTROLLER (PlayGameView)   │
│                               │
├───────────────────────────────┤
│  [ 📺 主持畫面 ] [ 🎮 我的手把 ] │ ← fixed bottom switch (safe-area)
└───────────────────────────────┘
```

- Host-only (`role: "display"`, i.e. "我也要一起玩" off): no switch, just the
  compact stage.
- Host plays: both tabs, default **主持畫面**; the last tab per room is
  remembered. During the rules phase it opens on **我的手把** so the host can
  press 「我看懂了」 (they can still skip for everyone, and the stage is one tap
  away).
- The switch is the only new permanent chrome. `HostShell` / `PlayShell` get a
  `phoneHost` flag via a small context so:
  - their duplicate top bars are suppressed (the wrapper owns the top bar),
  - `PlayShell`'s fixed score dock is suppressed (score moves into the wrapper
    bar so it never collides with the switch),
  - `HostShell` padding is reduced and `--stage-scale` typography kicks in.
- Switching tabs unmounts one view and mounts the other; game state lives in
  the room, so no state is lost. The tick loop and `FloatingReactions` stay in
  the provider, not the views.
- `RulesTour` needs no new variant: `variant="play"` already shows both
  「我看懂了」 (when host is a participant) and 「房主開始遊戲」.
- `HostGameControls` (restart / end match) stays available from the stage.

### 2.4 Compact stage styling

Instead of rewriting 16 host views, add a `.phone-stage` scope applied by
`HostShell` when the room is in phone mode:

- reduce outer padding (`p-3`), heading sizes (`text-5xl → text-3xl`), card
  padding and grid gaps via a scoped CSS layer in `globals.css`,
- force `overflow-x: hidden` and `min-w-0` on flex/grid children so no view can
  push the page sideways,
- keep game-specific interaction sizes untouched (drawing canvas stays
  square/aspect-limited, Simon tiles stay tappable).

Then fix by hand only the views that still overflow at 320–430px (audit below).

### 2.5 Always-on hosting

- **Wake lock**: `useScreenWakeLock()` (Feature-detected, re-acquired on
  `visibilitychange`) while the phone host is in lobby or playing. A locked
  phone screen is the phone-host equivalent of someone turning off the TV.
- **Keep the tab alive** note in lobby: 「主持中請保持這個畫面開啟」.
- Optional polish (not required for v1): a `全螢幕` button using
  `document.documentElement.requestFullscreen()` / orientation lock.

### 2.6 Copy that stops assuming a TV

- `PlayClient` lobby: 「請看電視大螢幕」 → 「請看主持畫面」 (or host nickname).
- Player views' 「看大螢幕…」 → 「看主持畫面…」 where it reads naturally.
- `startRoomGame` error 「至少需要 N 位手機玩家（電視不計入）」 → mode-aware copy.
- Landing page mentions both ways to host (one extra line, not a rewrite).
- README + a new `docs/phone-host-mode.md` for the shipped behaviour.

---

## 3. Data model & plumbing

```ts
export type HostMode = "tv" | "phone";

interface Room {
  /** How this room is presented. Absent = "tv" (rooms created before this feature). */
  hostMode?: HostMode;
  ...
}
```

- `createRoom(gameId, nickname, settings?, sessionPlan?, options?)` gains
  `options.hostMode` and `options.hostPlays`. Host player record becomes:
  - `tv` → `role: "display"`, `isReady: true` (unchanged),
  - `phone` + playing → `role: "player"`, `isHost: true`, `isReady: false`,
  - `phone` + not playing → `role: "display"`, `isReady: true`.
- `parseRoom` defaults missing/invalid `hostMode` to `"tv"`.
- `database.rules.json`: **no change needed** — the room-level `.validate` only
  requires known children, extra host-written fields are already accepted
  (same path as `sessionPlan`). Players record already stores `role`.
- No schema change for readiness/turns: `isParticipant()` already drives
  participants, turns, scores, and `startRoomGame` minimums. A host with
  `role: "player"` is counted automatically.

---

## 4. File-by-file change list

### New
| File | Purpose |
|---|---|
| `docs/phone-host-mode.md` | Shipped behaviour + how to test. |
| `src/constants/hostMode.ts` | `HOST_MODES`, labels, `isHostMode`, `defaultHostModeFor(device)`. |
| `src/lib/hostMode.ts` | Pure helpers: `resolveHostRole(hostMode, hostPlays)`, `hostModeOf(room)`, copy helpers. Unit-testable. |
| `src/components/game/HostModePicker.tsx` | The two cards + 「我也要一起玩」 toggle, used by both create flows. |
| `src/components/game/PhoneHostChrome.tsx` | Unified top bar + bottom stage/controller switch + presentation context. |
| `src/app/room/[roomCode]/host/PhoneHostGameView.tsx` | Tabs between `HostGameView` and `PlayGameView`; handles the rules-phase default tab. |
| `src/hooks/useScreenWakeLock.ts` | Wake Lock API with graceful fallback. |
| `src/components/game/HostModeBadge.tsx` (optional) | 「手機主持」 badge shown in the lobby / results. |

### Modified
| File | Change |
|---|---|
| `src/types/index.ts` | `HostMode`, `Room.hostMode`. |
| `src/providers/RoomContext.tsx` | `createRoom` options + host role/readiness; expose `hostMode`. |
| `src/lib/roomData.ts` | Parse `hostMode`. |
| `src/app/create/[game]/CreateRoomClient.tsx` | Host mode picker, dynamic nickname label, honest helper copy. |
| `src/app/random/RandomPartyClient.tsx` | Same picker; pass options into `createRoom`. |
| `src/app/room/[roomCode]/host/HostPage.tsx` | Phone mode → `PhoneHostGameView`; display host keeps `HostGameView`. |
| `src/app/room/[roomCode]/host/HostGameView.tsx` | Pass `phoneHost` to `HostShell`/`RulesTour`. |
| `src/components/game/HostShell.tsx` | `phoneHost` presentation: slim/no top bar, `.phone-stage` scope, smaller padding. |
| `src/components/game/PlayShell.tsx` | Suppress dock/top bar when embedded in the phone-host wrapper. |
| `src/app/room/[roomCode]/host/HostLobbyClient.tsx` | Phone presentation: smaller QR, share button, ready toggle, copy, wake lock. |
| `src/app/room/[roomCode]/play/PlayClient.tsx` + player views | 「大螢幕/電視」 → 「主持畫面」. |
| `src/lib/gameSession.ts` | Mode-aware minimum-player error copy. |
| `src/app/globals.css` | `.phone-stage` typography/spacing/overflow scope; dock offset if needed. |
| `README.md`, `src/app/(landing)/page.tsx`, `src/app/layout.tsx` | Mention that the host can be a phone. |
| `e2e` specs that read 「房主暱稱（顯示在電視上）」 | Keep the TV default label unchanged so existing specs stay valid; add phone-mode specs with the new label. |

---

## 5. Verification plan

### Unit (Vitest)
- `src/lib/hostMode.test.ts`: role resolution for the 4 combinations; default
  parse of legacy rooms; invalid values fall back to `"tv"`.
- `src/lib/roomData.test.ts` (extend): round-trip `hostMode` through
  `databaseRoundTrip` (RTDB drops nothing here, but keep the guarantee).
- `src/providers/RoomContext.test.tsx` (extend): phone mode creates a host that
  is a participant and not auto-ready; TV mode stays display + ready; session
  draw carries the option through.
- `src/engine/participants` / `gameSession` tests: a playing host counts toward
  min/max players, receives turns, and appears in scores.

### Component
- `HostModePicker`: default-on toggle, phone-only sub-option, persistence.
- `PhoneHostGameView`: rules phase opens on 我的手把; switch renders the other
  view; display-only host has no switch.

### E2E (Playwright, project viewport is already 390×844)
1. **Phone-only full match** (`phone-host.spec.ts`): create in phone mode with
   host playing → join one friend → both ready → play one round of
   Everybody Knows → host votes from 我的手把 → results → rematch. Asserts the
   room has 2 participants (host included), scores include the host.
2. **Stage smoke for all 16 games**: seed a phone-host room with the host as a
   participant for every playable game; visit `/host`; assert stage mounts,
   switch to 我的手把, and `document.scrollingElement.scrollWidth <= innerWidth`
   in both tabs. Also run at 320px.
3. **Legacy rooms**: seeded room with no `hostMode` still renders the old TV
   flow (guards the default).
4. **Host-only phone mode**: 「我也要一起玩」 off → no controller switch, host
   not in score list, start still requires the game's minimum phone players.

### Manual/runtime
- `npm run typecheck && npm run lint && npm run test && npm run build`.
- Local demo mode (two ordinary tabs) covers the whole flow without Firebase.
- Real device check remains external: iOS Safari + Android Chrome, phone host
  screen-off behaviour, and background-tab tick accuracy.

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Host playing = host can see secrets | Host views only reveal secrets at reveal/result today; keep it that way, and add a test that undercover/spy names never appear during `viewing_words`/`discussion`/`voting`. |
| Phone host tab gets backgrounded → game clock stalls | Keep the same single-tab tick loop; wake lock; the existing stale-host recovery still applies. Copy warns to keep the screen on. |
| Long/tall host views are awkward on a phone | `.phone-stage` scope + per-view audit; stage always scrolls; switch is fixed. |
| Adding a field breaks old clients / rules | Optional field with a `"tv"` default, host-written like `sessionPlan`; rules untouched. |
| Host phone loses network mid-game | Existing reconnect badge + host recovery; the host is also a player now, so no new failure mode. |
| Scope creep into a responsive rewrite of 16 host views | v1 ships the CSS scope + targeted fixes; deep per-game redesign is a follow-up. |

---

## 7. Suggested delivery slices

1. **Data + creation** — `hostMode`, `createRoom` options, picker in both
   create flows, `parseRoom`, tests.
2. **Phone host experience** — lobby presentation (share/ready/wake lock) and
   `PhoneHostGameView` with stage/controller switch.
3. **Compact stage** — `.phone-stage` scope + per-view overflow fixes + all-game
   smoke test.
4. **Copy/docs** — remove TV-only wording where it is now wrong, README,
   `docs/phone-host-mode.md`, landing mention.

Slices 1–2 already deliver "complete party, no big screen". Slice 3 is what
makes the stage comfortable rather than merely functional.
