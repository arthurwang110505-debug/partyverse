# Cross-device join fix — 2026-09-23

## Symptom and confirmed code defect

A host sees an existing Firebase room while a fresh phone reports that the room does not exist.

`joinRoomOnFirebase` used `get(roomRef)` followed by a room transaction that aborted when its input was null. The code and previous test double assumed `get()` permanently warmed the SDK cache. In the installed Firebase SDK, `repoGetValue` removes its temporary event registration before resolving. With no other active query, the room is not retained. The transaction's first, synchronous local invocation therefore sees null and aborts without contacting the server.

The host's existing subscription conceals this issue on the host device.

## Fix

- Attach a persistent `onValue` listener and await its first snapshot.
- Keep that listener attached until the join transaction settles; do not use `onlyOnce`.
- Release our listener in `finally` on success, missing room, full room, error, or timeout.
- Disable speculative local transaction events with `applyLocally: false`.
- Recheck capacity and room existence on transaction retries; never substitute an old snapshot for null (which could recreate a deleted room).
- Abort full-room transactions by returning undefined, not throwing from an asynchronously retried SDK callback.
- Normalize surrounding whitespace/case in room codes.
- Preserve timeout errors and recognize uppercase `PERMISSION_DENIED` separately from missing rooms.
- Prevent a transaction updater invoked after timeout from adding a player. An already-sent write cannot be cancelled by a JavaScript timeout and may still be acknowledged; retrying with the same authenticated identity is idempotent.

## Verification

- 196 unit/regression tests passed, including 15 join lifecycle/error cases.
- Three additional tests exercise the actual installed Firebase SDK's cache and transaction code, using a fake read-only HTTP response and intentionally aborted writes. They reproduce the `get()` and `onlyOnce` cache loss and verify the persistent-listener behavior. They do not contact a real project or verify security rules.
- Typecheck, lint, and production build passed.
- This change has not been deployed to or tested against the user's production Firebase database.

## Production rollout and remaining checks

1. Deploy the updated branch/code to the production site, then refresh both the host and joining phones. Re-deploying an unchanged older main branch will not include the fix.
2. Create a fresh room and use its invitation URL on a separate phone/browser profile. Confirm the phone appears in the host roster.
3. If the new error mentions **安全規則**, inspect the deployed Realtime Database rules. The legacy README example grants room-root writes only to existing members, but the current atomic join writes the entire room. A child-only grant at `players/$playerId` does not authorize this ancestor transaction. This is a separate compatibility issue; do not work around it by enabling public writes or broadly allowing any user who adds themselves to modify the room. Production needs a reviewed join authorization design (preferably a trusted backend for admission and game authority).
4. If the room truly is absent, confirm both devices use the same deployed site and the same explicit `NEXT_PUBLIC_FIREBASE_DATABASE_URL`, including its region. Firebase public environment settings are baked in at build time, so changes require rebuilding.
5. A room marked **本地展示模式** is browser-local and cannot be joined from a physical second device. Configure Firebase and create a new online room; an existing demo room is not automatically uploaded.

No production credentials, database rules, or live rooms were changed by this patch.
