# 第二次開房被踢回 /join — 2026-09-24

## 症狀

同一個裝置（電視）建立房間、關掉房間之後，再建立第二間房：

- 房間確實建立了（`createRoom` 回傳新房間代碼，`/room/<code>/host` 也進去了）。
- 但大螢幕畫面立刻「閃退」成**加入房間**的 `/join/<code>` 畫面（顯示 5 碼房間代碼與暱稱欄位）。

## 根本原因

### 1. `/create` 與 `/room` 掛載的是「不同的」RoomProvider

`src/app/create/layout.tsx`、`src/app/join/layout.tsx`、`src/app/room/layout.tsx` 各自 import 同一份 `PartyLayout`，但它們在 React 樹裡是**不同的 component 實例**。從 `/create/<game>` 導覽到 `/room/<code>/host` 時，Next.js 會把舊 layout 整棵樹卸載、掛載新的一棵——`RoomProvider` 的 `room` / `player` state 就這樣被丟掉，新 provider 從 `room = null` 開始，只能靠 storage 裡的工作階段重新連回房間。

### 2. 重新連線的空窗期被 `RoomGate` 判成「你不是這間房的人」

舊版 `RoomGate`：

```ts
if (!loading && (!player || room?.id !== roomCode)) router.replace(`/join/${roomCode}`);
```

它只有兩種狀態：「還在載入」與「不在這間房」。但重新掛載後其實有三種：

1. 還在載入（`loading`）；
2. **正在接手這間房**（`subscribe()` 已發出，第一個 snapshot 還沒回來）；
3. 確定不是這間房的人。

第 2 種在 Firebase 模式下最明顯：`subscribe()` 是非同步的，而原本的工作階段還原流程在 `finally { setLoading(false) }` 就放行了——snapshot 還沒到、`room` 仍是 `null`（或仍是上一間房），閘門就在下一個 effect 直接 `router.replace('/join/<code>')`。第一個 snapshot 隨後才到，但畫面已經跳到加入房間，`/join/<code>` 沒有閘門，所以也不會自己跳回來。

第一次開房之所以「看起來沒事」，是因為那條路徑的時間差剛好被壓掉（同一次交易寫入還在 SDK 快取裡、或登入狀態還在解析中）；第二次開房（舊房間已刪除、工作階段重寫、DOM/網路時序不同）就露出破綻。屬於競態，不是穩定的「第二次一定壞」。

### 3. 結束房間時的同一個競態（e2e 實測抓到）

「結束房間」會清空 provider 的 state（`room` / `player` / session），但畫面還停在 `/room/<code>/host`。舊閘門在下一次 render 就把網址改成 `/join/<code>`，並與 `HostLobbyClient` 的 `router.push("/")` 互相賽跑——結果就是房主按了「結束房間」後被丟到已刪除房間的加入畫面。修正後這種「房間已經不存在」的情況一律回首頁，並跳出「房間已經結束了」提示。

### 4. 本地展示模式的隱性失敗

`saveLocalRoom()` 把 `localStorage` 寫入失敗（配額、無痕模式）整個吞掉，於是「建立成功」但房間讀不回來：`subscribeLocalRoom()` 的第一個 callback 得到 `null`，provider 立刻清空 state 與工作階段，畫面同樣掉到 `/join`——第二次開房特別容易遇到，因為上一間房的資料還躺在 `localStorage` 裡。

## 修正

1. **`src/lib/roomSession.ts`（新）**：把「這個分頁目前在哪一間房」保存在 React 之外的模組層級快照。provider 重新掛載時可以直接以這間房開場（`useState` 初始值），不必等任何 I/O。純記憶體、不落地，離開或房間消失時清除。
2. **房主開房時先把房間交給 UI**：`createRoom()` 拿到交易成功後立刻 `adoptRoom(...)`（寫入快照 + `setRoom` / `setPlayer`），導覽到 `/room/<code>/host` 時畫面已經有房間，`isHost` 也改用 `user?.uid ?? player?.id`，即使 Firebase auth 還沒解析完也不會被當成非房主。
3. **`src/lib/roomEntry.ts`（新）**：把閘門判斷抽成純函式 `decideRoomEntry()`，明確區分 `wait`（載入中或正在接手這間房）／`join`／`play`／`ready`。`RoomGate` 與 `ResultsPage` 都改用它；`RoomContext` 新增 `pendingRoomCode`，在 create/join/工作階段還原期間標記「正在接手哪一間房」，只有確定不是成員時才會導向 `/join`。
4. **工作階段還原改為等到第一個 snapshot**：Firebase 模式在 `subscribe()` 收到第一筆資料（或失敗）之後才 `setLoading(false)`；成員檢查（`get()`）失敗時改為「交給 snapshot 判斷」，不再直接丟掉工作階段。
5. **房間消失時回首頁**：`RoomContext` 新增 `lostRoomCode`（並在 `src/lib/roomSession.ts` 記住整個分頁「剛剛結束的房間」），`RoomGate` / `ResultsPage` 對這種網址改為回首頁並提示，不再導向已經不存在的房間代碼。
6. **`saveLocalRoom()` 回傳布林值**：建立房間時若寫入失敗，直接顯示「儲存空間不足」的錯誤，而不是產生一個讀不回來的房間。

## 驗證

- `npm run typecheck`、`npm run lint`、`npm run test`（18 files / 211 tests）、`npm run build` 全數通過。
- 新增單元測試：
  - `src/lib/roomEntry.test.ts`：第二次開房的關鍵情境——provider 手上還沒有新房間（或仍是舊房間）時必須 `wait`，不得 `join`；確定非成員時仍要導向 `/join`；房間已結束時導向 `/`；手機開 host 網址仍導向 `/play`。
  - `src/lib/roomSession.test.ts`：provider 重新掛載後仍能拿到剛剛建立的房間；離開/結束後清空；SSR 期間為空（不影響 hydration）。
- **新增元件回歸測試 `src/providers/RoomContext.test.tsx`（jsdom）**：以記憶體假 Firebase 掛載真正的 `RoomProvider` + `RoomGate`，房間 snapshot 由測試決定何時送達。測試會建立房間 → 卸載／重新掛載 provider（等同 `/create` → `/room` 的換 layout）→ 在 snapshot 還沒回來時檢查畫面，正是 bug 的發生點。
  - 已確認：把 `RoomContext.tsx`／`RoomGate.tsx` 還原成修正前的版本時，這個測試**會失敗**（`Unable to find [data-testid="host-view"]`、手機被送到 `/join/<code>`），修正後通過。
  - 也因此 vitest 設定新增 `src/**/*.test.tsx` 與 `esbuild.jsx = "automatic"`，並加入 devDependencies `jsdom`、`@testing-library/react`。
- **新增 e2e `e2e/host-lifecycle.spec.ts`**（建立 → 結束房間 → 同一裝置再建立，網址必須留在 `/room/<code>/host`）。這個測試在修正「結束房間被丟到 `/join`」之前是失敗的。`npx playwright test` 全部 58 個測試通過。
- 沒有實際連線到正式 Firebase 專案，也沒有驗證安全規則；Firebase 的時序問題是由元件回歸測試（假 SDK，可控制 snapshot 延遲）與既有的 `docs/firebase-join-fix.md`（`get()` 不保留快取、`onValue` 才是權威）共同驗證。

## 實際上線要確認的事

1. 電視：建立房間 → 玩一輪 → 結束房間 → 再建立房間，網址必須停在 `/room/<code>/host` 並顯示「遊戲大廳」。
2. 電視：在 `/room/<code>/host` 重新整理，應回到同一間房的遊戲大廳（或最多停在「連接房間中…」，不可跳到 `/join`）。
3. 手機：掃碼加入後應停在 `/room/<code>/play`；重新整理亦然。
4. 若仍會跳到 `/join`，請提供瀏覽器 console 的 `[partyverse] ...` 訊息——`Room listener failed` 或 `Firebase session restore check` 會指出是讀取權限或連線問題。
