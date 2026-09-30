import { MOCK_NOW } from "@/components/store/mock-data";

// Where the Store Manager screens get their data.
//   NEXT_PUBLIC_STORE_DATA_SOURCE=mock (default) — the mock data in components/store/mock-data.ts
//   NEXT_PUBLIC_STORE_DATA_SOURCE=api            — the backend at NEXT_PUBLIC_API_URL
// Stays on mock until the Store Manager migration is applied to the shared database.
export const STORE_DATA_SOURCE: "mock" | "api" =
  process.env.NEXT_PUBLIC_STORE_DATA_SOURCE === "api" ? "api" : "mock";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");

// The signed-in manager's outlet. Comes from the Keycloak profile once login exists.
export const STORE_OUTLET_ID = Number(process.env.NEXT_PUBLIC_STORE_OUTLET_ID || 1);

/** "Now" for cutoffs and relative dates: the fixed demo moment for mock data, the real time for the API. */
export function storeNow() {
  return STORE_DATA_SOURCE === "api" ? new Date() : MOCK_NOW;
}
