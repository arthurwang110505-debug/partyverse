import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import * as databaseSDK from "firebase/database";
import { get, getDatabase, onValue, ref, runTransaction, type DatabaseReference } from "firebase/database";

/** Uses the REAL Firebase SDK cache/transaction code. Only the read transport
 * is a fake HTTP response. No live project, auth credentials or writes are used.
 * The intentionally aborted transactions expose their first cached input.
 * This is not an emulator/security-rules integration test.
 */
// Test-only hook is exported by this pinned SDK but intentionally not in its public types.
const forceRestClient = (
  databaseSDK as unknown as {
    _TEST_ACCESS_forceRestClient: (enabled: boolean) => void;
  }
)._TEST_ACCESS_forceRestClient;
const ROOM = { id: "ABCDE", players: { host: { nickname: "Host" } } };
let app: FirebaseApp;
let roomRef: DatabaseReference;
let stop: (() => void) | undefined;
let sequence = 0;

beforeEach(() => {
  forceRestClient(true);
  vi.stubGlobal(
    "XMLHttpRequest",
    class {
      readyState = 0;
      status = 200;
      responseText = JSON.stringify(ROOM);
      onreadystatechange?: () => void;
      open() {}
      send() {
        queueMicrotask(() => {
          this.readyState = 4;
          this.onreadystatechange?.();
        });
      }
    },
  );
  app = initializeApp(
    { projectId: "demo-cache-test", databaseURL: "https://demo-cache-test.firebaseio.com" },
    `cache-${sequence++}`,
  );
  roomRef = ref(getDatabase(app), "rooms/ABCDE");
});
afterEach(async () => {
  stop?.();
  stop = undefined;
  await deleteApp(app);
  forceRestClient(false);
  // Aborted transactions can still have an already-started read in flight.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  vi.unstubAllGlobals();
});

async function firstTransactionInput() {
  let observed: unknown = "not-called";
  await runTransaction(roomRef, (current) => {
    observed = current;
    return undefined; // observe cache only, deliberately do not send a write
  });
  return observed;
}

describe("real Firebase SDK cache lifetime", () => {
  it("get() returns a real room but does not pin it for the next transaction", async () => {
    expect((await get(roomRef)).val()).toEqual(ROOM);
    expect(await firstTransactionInput()).toBeNull();
  });

  it("a persistent onValue subscription keeps the room available for the transaction", async () => {
    await new Promise<void>((resolve, reject) => {
      stop = onValue(roomRef, () => resolve(), reject);
    });
    expect(await firstTransactionInput()).toEqual(ROOM);
  });

  it("an onlyOnce listener has the same cache-loss problem as get()", async () => {
    await new Promise<void>((resolve, reject) => {
      stop = onValue(roomRef, () => resolve(), reject, { onlyOnce: true });
    });
    expect(await firstTransactionInput()).toBeNull();
  });
});
