// `Providers` is a named export; the previous barrel default-imported it, which
// is a type error (TS2613) and would have thrown at runtime had anything used it.
export { Providers } from "./Providers";
export { RoomProvider, useRoom, usePlayer, useCurrentRoom, type ConnectionStatus } from "./RoomContext";
