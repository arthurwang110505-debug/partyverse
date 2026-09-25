/**
 * Shared "server time" for sub-second games. Every device applies the RTDB
 * `.info/serverTimeOffset`, so a mole schedule written by the TV and a tap
 * validated on a phone are compared on the same clock even if the phone's
 * own clock is seconds off.
 */
let offsetMs = 0;

export function setServerOffset(ms: number): void {
  offsetMs = Number.isFinite(ms) ? ms : 0;
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}
