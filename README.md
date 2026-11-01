# PARTYVERSE

One Room. 16 Games. Infinite Chaos.

多人派對遊戲平台：一支手機就能開場。掃描 QR code 就能立即加入，免下載、免註冊。

- **大螢幕主持**：電視或電腦當主畫面，手機就是控制器（預設）。
- **手機主持**：沒有電視也沒關係，主持手機就是舞台，主持人還能同時下場一起玩。
  詳見 [docs/phone-host-mode.md](docs/phone-host-mode.md)。

## Quick Start

```bash
npm install
cp .env.example .env.local  # 填入 Firebase 設定
npm run dev
```

### Scripts

- `npm run dev` — 啟動開發伺服器
- `npm run build` — 正式環境編譯（靜態預渲染 + 類型驗證）
- `npm run lint` — ESLint 靜態檢查
- `npm run typecheck` — TypeScript 嚴格模式全專案類型檢查
- `npm run test` — Vitest 單元測試（遊戲引擎與工具函式）

## Firebase Setup

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 建立新專案
3. 啟用 **Realtime Database**
4. 啟用 **Authentication** → **Anonymous（匿名登入）**
5. 將專案金鑰複製到 `.env.local`

## Database Rules

**Deployable rules live in [`database.rules.json`](database.rules.json).**  
See [docs/firebase-rules.md](docs/firebase-rules.md) for what they allow, how to deploy, and the remaining anti-cheat roadmap.

> Do **not** open the database to public read/write to “fix” join. If phones still get `PERMISSION_DENIED`, read [跨裝置加入修正與部署排錯](docs/firebase-join-fix.md) and confirm the deployed rules match the JSON in this repo.

## 隨機派對模式

不想挑遊戲時，可選 3 / 5 / 10 分鐘時間盒，或挑戰 **決戰模式**：隨機抽 8 款不同遊戲，各局原始分數直接相加，等八款全部玩完才公布總排名。決戰模式至少需要 4 位玩家。建議設定會自動套用，大廳仍可自由調整；全場不用重新掃碼。

- 入口：首頁、`/random`、`/create` 模式卡、大廳與結算畫面
- 抽選邏輯：`src/lib/playlist.ts`；玩過什麼：`src/lib/playHistory.ts`
- 詳細說明：[docs/play-modes.md](docs/play-modes.md)

## Gameplay/mobile implementation update

See [the first-pass implementation and verification notes](docs/gameplay-implementation.md).

Latest: [隨機派對模式](docs/play-modes.md) — 3/5/10-minute time boxes plus an 8-game battle mode that directly sums each game's raw scores and reveals the final ranking only after all eight games.

Previous: [2026-09-24 room re-entry fix](docs/room-reentry-fix.md) — creating a second room on the same device no longer dropped the host from the big-screen view into `/join/<code>` (the create and room segments mount different providers, and the room gate treated "still opening this room" as "not a member").

Previous: [2026-09-23 gameplay foundation](docs/gameplay-foundation.md) — all 15 games now have readiness-based briefings and in-game rules reminders; Poker and Word Chain have fairness/pacing fixes. Includes verification results and the remaining roadmap.

The host device can be a TV (display-only, the default) or a phone. In the new
[phone-host mode](docs/phone-host-mode.md) the host phone is the stage, and the host can play
from that same phone by switching between 「主持畫面」 and 「我的手把」 — a complete party with
no projector, TV or computer. **Local demo mode only shares rooms between ordinary tabs in the same browser** — use the lobby's “開新分頁當玩家” link. Physical phones and separate/incognito browser profiles require configured Firebase.

Browser regressions: `npx playwright install chromium && npm run test:e2e` (local/demo data only).
