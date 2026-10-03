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

import { apiFetch, ApiError } from "@/components/store/api/client";

// --- Receipts API & Offline Helpers ---

export async function submitDeliveryReceipt(payload: ReceiptCreatePayload): Promise<{ receipt?: DeliveryReceipt; isOffline?: boolean }> {
  try {
    const receipt = await apiFetch<DeliveryReceipt>("/receipts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { receipt, isOffline: false };
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      if (err.status === 409 || err.message.includes("already submitted")) {
        throw err;
      }
    }
    const message = err instanceof Error ? err.message : "";
    if (message.includes("already submitted")) {
      throw err;
    }
    // Queue in localStorage for offline sync
    saveOfflineReceipt({ ...payload, synced_from_offline: true });
    return { isOffline: true };
  }
}

export async function syncOfflineReceipts(receipts: ReceiptCreatePayload[]): Promise<{ synced: number; skipped: number }> {
  try {
    return await apiFetch<{ synced: number; skipped: number }>("/receipts/sync", {
      method: "POST",
      body: JSON.stringify({ receipts }),
    });
  } catch {
    throw new Error("Sync failed");
  }
}

export async function getDeliveryReceipt(orderId: number | string): Promise<DeliveryReceipt | null> {
  try {
    const receipt = await apiFetch<DeliveryReceipt>(`/receipts/${orderId}`);
    return receipt ?? null;
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
