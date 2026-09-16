"use client";

import { useEffect, useState } from "react";
import { RoomProvider } from "@/providers/RoomContext";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <RoomProvider>{children}</RoomProvider>;
}
