# 手機主持模式（沒有大螢幕也能玩完整場）

PartyVerse 原本假設「電視 = 主持畫面、手機 = 手把」。這個模式把電視拿掉：
**主持人的手機就是全場的舞台**，而且主持人可以同時下場一起玩。

## 使用方式

建立房間時（`/create/<game>` 或 `/random`）選擇主持方式：

| 主持方式 | 誰是玩家 | 主持裝置 |
|---|---|---|
| 📺 **大螢幕主持**（預設） | 所有參賽者都要用手機掃碼 | 電視／電腦只顯示，不占名額 |
| 📱 **手機主持** | 主持手機 + 其他手機 | 主持手機顯示舞台，可切換到自己的手把 |

手機主持下有一個 **「我也要一起玩」** 開關（預設開啟）：

- **開**：主持人是正式參賽者（`role: "player"`），會算進人數、回合、計分，也要按「就緒」。
  開打後主持手機有兩個分頁：**主持畫面**（大家看的舞台）與 **我的手把**（自己的控制器）。
- **關**：主持手機只是顯示器（`role: "display"`），不占玩家名額，只能看舞台。

選擇會記在這台裝置（`localStorage: partyverse_host_mode`）。第一次進來時，
窄螢幕的觸控裝置會預設選手機主持，桌機／平板預設維持大螢幕主持。

## 手機主持的流程

1. **大廳**：標題變成「手機主持」，QR code 縮到 200px，多一顆 **分享邀請**
   （有 `navigator.share` 就用系統分享面板，否則複製連結）。
   主持人若參賽，名單上會顯示自己的「房主 · 已就緒／待命中」，下方有「我也準備好了」。
2. **開始遊戲**：簡報（規則）階段會自動切到 **我的手把**，因為「我看懂了」按鈕在那一半；
   簡報結束後自動切回 **主持畫面**。其他時候都由主持人自己決定看哪一半。
3. **遊戲中**：底部固定分頁列同時顯示主持畫面與我的手把，兩個分頁都在同一個瀏覽器分頁裡，
   **遊戲計時不會因為切換而停止**（tick 由 provider 驅動，與顯示內容無關）。
4. **結算**：主持人照樣可以「再玩一次」、「換一款遊戲」或抽下一個隨機時段。

## 螢幕不要睡著

手機主持時大廳會啟用 **Screen Wake Lock**（`src/hooks/useScreenWakeLock.ts`），
支援的瀏覽器（Android Chrome / Edge、Safari 16.4+）會保持螢幕亮著，並在切回前景時重新取得鎖定。
不支援時大廳會直接寫明「請保持這個畫面開啟、螢幕不要關閉」，不假裝有效。

## 版面

16 個主持畫面原本是為 1080p 電視設計的（大字、寬格線、大留白）。手機主持時
`HostShell` 會加上 `.phone-stage` 範圍（`src/app/globals.css`），在裡面縮小標題級距、
區塊間距與卡片內距，並禁止水平溢出；遊戲本身的關鍵尺寸（畫布、四色方塊、計時器）不受影響。

**沒有改寫任何一個遊戲的版面邏輯**，所以大螢幕模式看起來與以前完全相同。

## 程式位置

| 檔案 | 作用 |
|---|---|
| `src/types/index.ts` | `HostMode`、`HostModeOptions`、`Room.hostMode` |
| `src/constants/hostMode.ts` | 兩種主持方式的文案、預設值、storage key |
| `src/lib/hostMode.ts` | `hostModeOf` / `resolveHostRole` / `hostIsPlaying` / `initialPhoneHostTab` / `screenNoun` |
| `src/hooks/useHostModeChoice.ts` | 建立房間時的選擇與記憶 |
| `src/components/game/HostModePicker.tsx` | 兩張主持方式卡 +「我也要一起玩」 |
| `src/components/game/PhoneHostChrome.tsx` | 手機主持的頂欄、分頁列、`usePhoneHostEmbedded()` |
| `src/app/room/[roomCode]/host/PhoneHostGameView.tsx` | 主持畫面 ↔ 我的手把 |
| `src/hooks/useScreenWakeLock.ts` | 螢幕保持開啟 |

### 相容性

- `hostMode` 是**選填**欄位，缺少時一律視為 `"tv"`，所以功能上線前建立的房間、
  舊版客戶端、以及 `database.rules.json` 都不需要改動
  （房間節點只驗證必要欄位，其他房主寫入的欄位沿用 `sessionPlan` 的路徑）。
- 電視房間建立的 payload 完全不變（不寫 `hostMode`）。
- 主持人的 `role: "player"` 自動被 `isParticipant()`、回合分配、計分、
  `startRoomGame` 的人數上下限採用，沒有第二套玩家邏輯。

## 驗證

- `npx tsc --noEmit`、`npm run lint`、`npm run test`（24 檔）、`npm run build` 全數通過。
- `src/lib/hostMode.test.ts`：舊房間預設為電視、四種角色組合、主持手機計入／不計入人數、
  開始遊戲的錯誤文案、`databaseRoundTrip` 後仍讀得回 `hostMode`。
- `src/components/game/HostModePicker.test.tsx`：只有手機主持會出現「我也要一起玩」。
- `src/app/room/[roomCode]/host/PhoneHostGameView.test.tsx`：簡報階段開在我的手把、
  簡報結束切回主持畫面、純顯示主持沒有分頁列。
- `src/components/game/PhoneHostChrome.test.tsx`：嵌進手機主持後，子畫面不再重複畫頂欄與計分列。
- `src/providers/RoomContext.test.tsx`：真的 provider 上建立手機主持房（參賽／純顯示／電視房不寫欄位）。
- `e2e/phone-host.spec.ts`（Playwright，390×844 與 320×640）：
  16 款遊戲的主持畫面與我的手把都能掛載、不水平溢出；舊房間仍走電視流程；
  **兩個人、一支主持手機 + 一支朋友手機就能從建立房間打到結算**；純顯示主持不占名額。

> 尚未驗證：真實 iOS/Android 裝置的螢幕鎖定行為、背景分頁的計時精度。
> 這些與 Firebase 實機測試仍列在既有的 production checklist 中。
