import { getAccessToken } from "@/lib/auth";
export interface DeliveryReceipt {
  id: number;
  order_id: number;
  outlet_id: number;
  units_received?: number | null;
  weight_received_kg?: number | null;
  has_issues: boolean;
  issue_type?: string | null;
  issue_description?: string | null;
  confirmed_at?: string | null;
  synced_from_offline: boolean;
}

export interface ReceiptCreatePayload {
  order_id: number;
  outlet_id: number;
  units_received?: number | null;
  weight_received_kg?: number | null;
  has_issues: boolean;
  issue_type?: string | null;
  issue_description?: string | null;
  confirmed_at: string;
  synced_from_offline?: boolean;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** JSON headers plus the signed-in user's token, so the backend scopes receipts to their outlet. */
function receiptHeaders(): Record<string, string> {
  const token = getAccessToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// --- Receipts API & Offline Helpers ---

/** The server refused the receipt (as opposed to the connection dropping). */
export class ReceiptRejectedError extends Error {}

export async function submitDeliveryReceipt(payload: ReceiptCreatePayload): Promise<{ receipt?: DeliveryReceipt; isOffline?: boolean }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/receipts`, {
      method: "POST",
      headers: receiptHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // The server answered and said no (already received, not dispatched yet, another outlet's order):
      // show why. Only a dropped connection is queued for later.
      const detail = await res.json().then((body) => body.detail).catch(() => null);
      throw new ReceiptRejectedError(typeof detail === "string" ? detail : `Receipt not accepted (${res.status}).`);
    }

    const receipt = await res.json();
    return { receipt, isOffline: false };
  } catch (err: unknown) {
    if (err instanceof ReceiptRejectedError) throw err;
    // Network failure: queue in localStorage; OfflineSyncBanner sends it when the connection is back.
    saveOfflineReceipt({ ...payload, synced_from_offline: true });
    return { isOffline: true };
  }
}

export async function syncOfflineReceipts(receipts: ReceiptCreatePayload[]): Promise<{ synced: number; skipped: number }> {
  const res = await fetch(`${API_BASE_URL}/api/receipts/sync`, {
    method: "POST",
    headers: receiptHeaders(),
    body: JSON.stringify({ receipts }),
  });
  if (!res.ok) throw new Error("Sync failed");
  return res.json();
}

export async function getDeliveryReceipt(orderId: number | string): Promise<DeliveryReceipt | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/receipts/${orderId}`, { headers: receiptHeaders() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to fetch receipt");
    return res.json();
  } catch {
    return null;
  }
}

// Local Storage Queue helpers

const OFFLINE_RECEIPTS_KEY = "offline_receipts";

export function getOfflineReceipts(): ReceiptCreatePayload[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(OFFLINE_RECEIPTS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveOfflineReceipt(receipt: ReceiptCreatePayload): void {
  if (typeof window === "undefined") return;
  const current = getOfflineReceipts();
  // Avoid duplicate queueing for the same order
  const filtered = current.filter((r) => r.order_id !== receipt.order_id);
  filtered.push(receipt);
  localStorage.setItem(OFFLINE_RECEIPTS_KEY, JSON.stringify(filtered));
}

export function clearOfflineReceipts(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(OFFLINE_RECEIPTS_KEY);
}
