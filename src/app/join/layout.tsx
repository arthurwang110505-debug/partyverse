import type { ReactNode } from "react";
import { Providers } from "@/providers/Providers";

/** Marketing pages do not hydrate Firebase or a room clock. */
export default function PartyLayout({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
