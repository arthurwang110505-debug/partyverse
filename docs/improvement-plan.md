# PartyVerse — Improvement Plan

Audit date: 2026-09-19 · Branch audited: `arena/01a0b95e-partyverse` @ `1a87b5c` · Stack: Next.js 14.2.35 (App Router) + React 18 + Tailwind 3 + Firebase RTDB + Framer Motion.

**Every number and claim below was produced by a command run against this checkout.** The command is named in each section. Nothing here is inferred from reading alone unless marked *(unchecked)*.

---

## 0. Current state — measured

| Check | Command | Result |
|---|---|---|
| Type safety | `npx tsc --noEmit` | **46 errors** across 15 files |
| Lint | `npx next lint` | **Crashes**: `Cannot read config file: .eslintrc.json — "module.exp" is not valid JSON` |
| Production build | `npm run build` | **Fails twice over**: (1) `next/font` cannot fetch Inter from Google Fonts; (2) after stubbing the font out in a scratch experiment, the build still fails at *"Linting and checking validity of types"* on `Property 'nameEn' does not exist on type 'GameDefinition'` |
| Tests | `find . -name "*.test.*" -o -name "*.spec.*"` | **0 files** |
| CI | `ls .github` | **does not exist** |
| SSR content on `/` | `curl /` + strip `<script>` | **6,434 bytes of body, 0 bytes of visible text, no `<h1>`** |
| Open Graph | `curl /` + regex `<meta og:\|twitter:` | **0 tags** |
| Games vs. playable engines | `grep -c` | **10 games defined, 1 engine registered** (`bombcountdown`) |
| Accessibility | `grep -rn "aria-" src` | **0 occurrences**; `focus:outline-none` ×5 with no `focus-visible`/`focus:ring` anywhere |
| Dev server | `next dev` | Starts; `/`, `/games`, `/games/[game]`, `/join`, `/create/[game]`, `/room/[code]/host` all return 200. Unknown routes return Next's **default white-on-black-404** page |

The site boots and looks good. It does not build, does not lint, and its core loop — a multiplayer game actually running — never starts. That ordering drives the plan.

---

## 1. P0 — Make it build (blocking everything else) · ~1 day

Nothing else can be trusted until `npm run build` and `npm run lint` are green. The 46 type errors collapse into **7 root causes**:

| # | Root cause | Evidence (`tsc`) | Fix |
|---|---|---|---|
| 1 | `GameDefinition` has no `nameEn`, but 10 game objects set it and 5 components read it | TS2561 ×11, TS2551 ×5 | Add `nameEn: string` to `src/types/index.ts` |
| 2 | `roomCode` declared with `let` and assigned only inside a `while` loop | TS2454 ×6 in `RoomContext.tsx:100–137` | Initialise to `""` or restructure the loop |
| 3 | `BombGameState` ⇄ `Record<string, unknown>` casts in the engine | TS2352 ×5, TS2322 ×4 in `engine/bombCountdown.ts` | Make `GameEngine` generic: `GameEngine<S>` with `gameState: S` |
| 4 | `db` is `Database \| null`, passed where `Database` is required | TS2345 ×4 (`HostGameView:26`, `PlayGameView:36`, `ResultsPage:21`, `RoomContext:41`) | Narrow once behind a `useDatabase()` guard hook |
| 5 | `sortedPlayers` state type omits `score`, which the code writes and renders | TS2339 ×4 in `ResultsClient.tsx:62–97` | Declare `{ id: string; player: Player; score: number }` |
| 6 | `hooks/useDebounce.ts` uses `useState`/`useEffect` with **no import** | TS2304 ×4 | Add the React import (file is currently unimportable) |
| 7 | `lib/index.ts` re-exports `Database`/`Auth` from `firebase/app`; `providers/index.ts` default-imports a named export | TS2305 ×2, TS2613 ×1 | Import from `firebase/database` / `firebase/auth`; use the named `Providers` |

**Also in P0:**

- **`.eslintrc.json` contains JavaScript.** Rename to `.eslintrc.js` (or convert the contents to real JSON). Note: `grep -c "typescript-eslint" package.json` returns **0** — the `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` the config references are not declared dependencies; they only resolve today because `eslint-config-next` happens to hoist them. Declare them explicitly, then wire `lint` and `typecheck` into CI.
- **`next/font/google` is a hard build-time network dependency.** Verified: with no route to `fonts.googleapis.com`, `npm run build` dies at *"Failed to fetch `Inter` from Google Fonts"*. Self-host the WOFF2 files and switch to `next/font/local`, and drop the weight list from 7 (`300;400;500;600;700;800;900` — visible in the failing request URL) to the 2–3 actually used. This removes a build-time external dependency and cuts font payload.

**Acceptance:** `npm run build`, `npm run lint`, `npx tsc --noEmit` all exit 0, in CI, on every push.

---

## 2. P0 — The game loop is dead (highest-value fix) · ~2–3 days

`grep` for every database write in `src/` returns **six call sites, all in `RoomContext.tsx`**: room creation (100), player join (174), kick (208), `status→PLAYING` (214), `status→RESULTS` (220), game switch (226).

**No code path ever writes `gameState`.** The consequence chain, all verified by reading the call sites:

1. `startGame()` writes only `{ status: "PLAYING" }` — `gameState` stays `{}`.
2. `HostGameView` and `PlayGameView` read `data.gameState` → `{}` → `phase` is `undefined`.
3. Both fall through to their final `else` branch → **"Loading…" forever**. Nobody is eliminated, no bomb ticks, no results.
4. `BombEngine` exists and is imported, but `HostGameView:33` runs `BombEngine.updateGameState(room)` on a `setInterval` and only calls `setDisplayState` — the tick is **host-local and never published**, so even if state were seeded, players would never see it move.
5. `ResultsClient:34` reads `gameState['score_' + id]`; `grep -rn "score_" src` finds that key in exactly one place — the read. Nothing writes it, so **the podium and full rankings always render "0 pts"**, while sorting silently uses the different `currentScores` map.

**Fix shape:**

- `startGame()` seeds state: `update(ref(db, rooms/{code}), { status: "PLAYING", gameState: engine.createGame(room), startedAt: Date.now() })`.
- Pick one clock authority. Host-authoritative is fine for a party game but must **write** each tick, not just `setState`. Server-authoritative (Cloud Function on a `/tick` write, or a per-room scheduled tick) is more robust against the host closing their laptop. Recommend starting host-authoritative + a `lastTickAt` watchdog, then migrating to Functions if drift shows up.
- Replace the three misused listener teardowns — `off(ref(db, …), "value", unsub)` in `HostGameView:26`, `PlayGameView:36`, `ResultsPage:21`. `onValue` returns an `Unsubscribe` function; it is not a callback, so `off()` with it detaches nothing and **listeners leak across route changes**. Use the returned function directly.
- Write scores to a single canonical path (`gameState.currentScores`) and read that one path in `ResultsClient`.
- `engine/index.ts` registers 1 of 10 games, and `loadGameEngine`'s dynamic `import(`./${gameId}`)` assumes every module exports `BombEngine`. Define the engine contract, then ship engines in dependency order: `bombcountdown` (fix) → `everybodyknows` and `aibullshit` (vote + reveal, cheap to build, high fun) → `whoisundercoveragent` → the rest. Until an engine exists, the game card should say **Coming soon** rather than link into a dead room.

**Acceptance:** two browsers, two devices — create room, scan QR, join, host presses Start, both clients see the same ticking bomb, one player is eliminated, results show non-zero points.

---

## 3. P1 — Realtime correctness around the loop · ~2 days

- **Room-code allocation races.** `RoomContext:84–88` loops `get()` until a free code, then `set()` — two concurrent creators can land the same code. Use `runTransaction`, or accept collision and re-check inside the write.
- **Refresh loses the live room.** The session-restore effect (`RoomContext:33–65`) does two one-shot `get()` calls and never attaches `onValue`, while `setLoading(false)` fires immediately on line 64. Reload mid-game and you get a stale frozen snapshot. Restore must re-subscribe.
- **Host leaves = zombie room.** `onDisconnect` only flips `isConnected` on the player; nothing handles the host's own disconnect. Add host migration or auto-end.
- **`handleEnd` doesn't end anything.** `HostLobbyClient:31–33` calls `confirm()` then `router.push("/")` — the room stays in RTDB forever. Combined with zero cleanup, **the database grows unbounded**. Add `remove()` plus a TTL sweeper (Function on `createdAt`), and replace the blocking `confirm()` with an in-app dialog.
- **Max players is read from the wrong object.** `RoomContext:160` reads `data.settings?.maxPlayers`, but `RoomSettings` has no `maxPlayers` field — it lives on `GameDefinition`. The check silently falls back to `|| 20`, so a 12-player game admits 20.
- **Every player gets the same avatar.** `RoomContext:94` and `:167` set `avatar: gameDef?.icon` — in a Bomb Countdown room, all 15 players render as 💣. `AVATARS` and `getAvatarFromName` already exist in the repo and are used nowhere (grep: 1 occurrence each = their own definitions).
- **Navigation during render.** `HostPage:33` and `PlayPage:33` call `router.push()` in the render body, not an effect — React can warn and double-navigate under Strict Mode (which `next.config.js` enables).
- **`useIsMobile`** (`hooks/useScreen.ts:16`) snapshots `window.innerWidth` once in a `useState` initializer and never re-measures on resize.

---

## 4. P1 — The marketing site is invisible to crawlers · ~1–2 days

`(landing)/page.tsx:17` is `if (!mounted) return null`. Measured on the served HTML: **6,434 bytes of body containing 0 characters of visible text and no `<h1>`** — the entire homepage is a client-only paint. Google, X, iMessage and Slack link previews see nothing.

- Delete the `mounted` gate. It exists to dodge a hydration warning; fix the warning instead (the `QRCodeSVG`'s `window.location.origin` read in `HostLobbyClient:59` is the same anti-pattern and belongs in an effect or a `useSyncExternalStore`).
- `layout.tsx` metadata has only `title` + `description`. Add `metadataBase`, `openGraph` (title/description/image/url/type), `twitter`, `icons`, `themeColor`, and `viewport`. Currently `grep` finds **zero** `og:`/`twitter:` tags.
- Add `generateMetadata` to `games/[game]/page.tsx` — 10 static, indexable landing pages with real `longDescription` copy sitting there unused. The page already has `generateStaticParams`.
- Add `app/sitemap.ts`, `app/robots.ts`, `app/icon.png`, `app/opengraph-image.png`.
- Add `app/not-found.tsx`. Unknown routes currently serve Next's stock **white-background** 404 (verified in the curl output) — a jarring flash against a `#050508` site. Add `app/error.tsx` and `loading.tsx` too; none exist.
- `<html lang="en">` while `constants/games.ts` is entirely Traditional Chinese ("陣營心理戰，找出誰是臥底！"). Either commit to zh-Hant with a proper `lang` attribute and i18n layer (next-intl), or finish translating the UI. Right now the page declares the wrong language to every screen reader and search engine.
- The README's tagline "One Room. Ten Games." is repeated in the hero (`page.tsx:47`) and footer (`:136`). With 1 engine of 10, that's an over-promise on the first screen — either build the engines or change the copy to what ships.

---

## 5. P2 — Accessibility · ~1–2 days

Baseline measured: **0 `aria-*` attributes in the whole `src/` tree**, **5 uses of `focus:outline-none` with no `focus-visible`/`focus:ring` replacement** (keyboard users get no focus indicator at all), and `<button>` nested inside `<Link>` in 4 places (`Navbar:37`, `Navbar:59`, landing `:52`, `:58`) — interactive-in-interactive, which is invalid HTML and confuses screen readers and tab order.

- Make the whole card clickable and drop the inner `<button>`, or use the anchor-as-button pattern.
- Add `focus-visible:ring-2 focus-visible:ring-violet-500` globally; pair every `focus:outline-none` with it.
- Add `aria-expanded`/`aria-controls` to the mobile menu button, `aria-label` to icon-only buttons (the copy-code and QR toggles are icon+text but the close affordances are not), `htmlFor`/`id` on every input, `role="status"` + `aria-live="polite"` on the error banners and the live game timer, and `prefers-reduced-motion` handling for `animate-bounce`/`animate-pulse`/Framer Motion.
- Contrast check the `text-white/30` and `text-white/40` body copy on `#050508` — `/games`'s results count and the footer copyright are the likely failures. *(Not measured with a contrast tool — worth an axe run.)*

---

## 6. P2 — Design system & performance · ~1–2 days

- **Tokens.** `globals.css` defines **17** CSS custom properties (`--primary`, `--card`, `--ring`, `--radius`, …). Grepping `src/` for `var(--…)`: only **3** are ever read — `--background`, `--border`, `--foreground`, and all three inside `globals.css` itself. `--primary` (the violet brand colour) is dead. Meanwhile every component hardcodes `bg-[#050508]` (20 occurrences) and `text-white/40`. Either consume the tokens or delete them, and promote page background, surface and game-accent colours into `tailwind.config.js` `theme.extend.colors` so a rebrand is a one-file change.
- **Landing page is one 143-line client component.** Convert it to a server component with small client islands (navbar scroll state only) — this is the same fix that unlocks the SEO work in §4.
- **Paint cost.** The hero stacks three `blur-[120px]`/`blur-[100px]` radial layers plus a grid overlay, and `.glass`/`.glass-card` apply `backdrop-filter: blur(20–24px)` to the navbar and every card. On mid-range Android — the primary device for a phone-as-controller party game — that's expensive. Measure on a real device, then cut blur radii, drop `backdrop-filter` below the fold, and gate the heavy layers behind `@media (prefers-reduced-motion)` / a low-power check. *(No device profiling done yet — flagged, not measured.)*
- **`prefetch` is on nearly every `<Link>`**, including all 10 game cards on the homepage — that eagerly fetches 10 routes. Keep it for the two CTAs, remove it from grids.
- `framer-motion` is imported into `/games` for a fade-in grid; consider CSS transitions there and reserve Framer for the in-game views that need it.

---

## 7. P2 — Security & data hygiene · ~1 day

- **`next.config.js` sets `Access-Control-Allow-Origin: *` together with `Access-Control-Allow-Credentials: true`.** That combination is rejected by browsers as invalid and, regardless, wildcard CORS on a game backend is wrong. Scope it or delete the block.
- **RTDB rules in the README** grant `"gameState": { ".write": "true" }` — any authenticated anonymous user can rewrite any room's game state. Tighten to the host's uid, and move score authority server-side.
- Anonymous auth is unthrottled: no rate limiting on room creation, no nickname sanitisation (length is capped at 16, content is not), and 5-character codes from a 32-char alphabet (~33M) are guessable but at least not trivial — fine for a party game, worth a note.
- No secrets leak (all Firebase vars are `NEXT_PUBLIC_`, which is correct for RTDB), and `.env*` is gitignored except `.env.example`. Good.

---

## 8. P3 — Quality infrastructure & cleanup · ongoing

- **0 tests, no CI.** Add Vitest + React Testing Library for the engines (they're pure `(room, action) → state` functions — ideal test targets, and they're where the bugs in §2 live) and Playwright for the create→join→start→results path with a Firebase emulator. Add a GitHub Actions workflow running `lint` + `typecheck` + `test` + `build` — the 46 type errors and the broken lint config would both have been caught on day one.
- **Dead code** (each grep count = its own definition only, i.e. never imported): `useDebounce`, `useLocalStorage`, `useIsMobile`, `useScreenMode`, `getAvatarFromName`, `formatTime`, `AVATARS`, `ROOM_CODE_LENGTH`, `ROOM_CODE_CHARS`, `BombCountdownGame` (a full duplicate of the entry in `constants/games.ts`), `getGameEngine`, `loadGameEngine`. Plus `src/app/games/[game]/GameDetailClient.tsx` (a one-line comment) and `src/app/(landing)/index.tsx` (a barrel file sitting inside a route folder). Either wire them up (several are the right tool for §3) or delete them.
- `useScreen.ts` and `useDebounce.ts` are named after one hook but export several — split per hook.
- Add Sentry (or equivalent) around the room flows; today a failed Firebase write is swallowed by `catch {}` in `HostLobbyClient:23` and `console.error` elsewhere.
- No analytics — for a share-via-QR product, join-funnel instrumentation (landing → create → join → first game started) is the single most useful thing to add.

---

## Sequenced roadmap

| Phase | Scope | Effort | Exit criterion |
|---|---|---|---|
| **P0-a** | 46 type errors, ESLint config + deps, self-host fonts, CI | ~1 d | `build` / `lint` / `tsc` green in CI |
| **P0-b** | Seed + publish `gameState`, canonical scores, fix `off()` leaks | ~2–3 d | Two devices complete a full Bomb Countdown round with real scores |
| **P1-a** | Reconnect re-subscribe, host migration, room TTL + real End, avatar/maxPlayers/room-code fixes | ~2 d | Reload mid-game keeps you in the room; no zombie rooms |
| **P1-b** | Kill the `mounted` gate, OG/meta, per-game metadata, sitemap/robots/icon, custom 404/error, `lang` + i18n decision | ~1–2 d | View-source shows full content; link previews render |
| **P2-a** | Focus states, aria, nested-button fixes, live regions, reduced motion | ~1–2 d | axe: 0 critical/serious violations; full keyboard playthrough |
| **P2-b** | Design tokens, landing → server component, blur/prefetch/motion budget | ~1–2 d | LCP on mid-range Android under ~2.5 s *(needs a real-device baseline first)* |
| **P2-c** | CORS + RTDB rules, input validation | ~1 d | No wildcard credentials CORS; `gameState` writes restricted to host |
| **P3** | Vitest + Playwright + emulator, dead-code removal, Sentry, analytics, engines 2–10 | ongoing | Engine coverage; join funnel visible; 4/10 games playable |

**The one thing to do first:** P0-a, then P0-b. A site that doesn't build and a game that never starts make every other improvement unverifiable.
