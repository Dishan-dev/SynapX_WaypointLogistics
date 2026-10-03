"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { StoreOutlet } from "@/components/store/mock-data";

// The signed-in manager's outlet, loaded once by the store layout and shared with the shell and client screens.
const StoreOutletContext = createContext<StoreOutlet | null>(null);

export function StoreOutletProvider({ outlet, children }: { outlet: StoreOutlet | null; children: ReactNode }) {
  return <StoreOutletContext.Provider value={outlet}>{children}</StoreOutletContext.Provider>;
}

/** null when the outlet couldn't be loaded (e.g. the server is unreachable). */
export function useStoreOutlet() {
  return useContext(StoreOutletContext);
}
