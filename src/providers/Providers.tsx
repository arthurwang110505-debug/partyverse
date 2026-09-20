"use client";

import { RoomProvider } from "@/providers/RoomContext";
import { ToastProvider } from "@/providers/ToastProvider";
import type { ReactNode } from "react";

/**
 * Client-only providers, mounted from the server root layout.
 * Kept as a separate component so `layout.tsx` can stay a server component.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <RoomProvider>
      <ToastProvider>{children}</ToastProvider>
    </RoomProvider>
  );
}
