# PARTYVERSE

One Room. Ten Games. Infinite Chaos.

多人派對遊戲平台：電視當主畫面，手機就是控制器。掃描 QR code 就能立即加入，免下載、免註冊。

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

在 Firebase Console > Realtime Database > 規則 中貼上以下規則：

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": "auth != null",
        ".write": "auth != null && (!data.exists() || data.child('players').child(auth.uid).exists())",
        "players": {
          "$playerId": {
            ".write": "auth.uid === $playerId || data.parent().parent().child('hostPlayerId').val() === auth.uid"
          }
        },
        "status": {
          ".write": "data.parent().child('hostPlayerId').val() === auth.uid"
        },
        "settings": {
          ".write": "data.parent().child('hostPlayerId').val() === auth.uid"
        },
        "gameState": {
          ".write": "data.parent().child('players').child(auth.uid).exists()"
        }
      }
    }
  }
}
```

## Gameplay/mobile implementation update

See [the first-pass implementation and verification notes](docs/gameplay-implementation.md).

The default host device is now a display-only TV; every participant (including the host who wants to play) joins using a separate controller. **Local demo mode only shares rooms between ordinary tabs in the same browser** — use the lobby's “開新分頁當玩家” link. Physical phones and separate/incognito browser profiles require configured Firebase.

Browser regressions: `npx playwright install chromium && npm run test:e2e` (local/demo data only).
