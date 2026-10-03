import { apiFetch, ApiError } from "@/components/store/api/client";
import { STORE_DATA_SOURCE, STORE_OUTLET_ID } from "@/components/store/api/config";

export interface StoreIssue {
  id: string;
  orderId: string;
  type: "Damaged Goods" | "Missing Items" | "Quantity Mismatch" | "Temperature Breach" | "Wrong Consignment" | "Other";
  title: string;
  affectedItem: string;
  sku: string;
  expectedUnits: number;
  receivedUnits: number;
  description: string;
  photoUrl?: string;
  photoName?: string;
  photoSize?: string;
  reportedAt: string;
  reportedBy: string;
  status: "open" | "under_review" | "resolved" | "credit_issued";
  resolutionNotes?: string;
  claimedAmount?: string;
  driverName?: string;
  vehicleId?: string;
}

export interface ApiDeliveryIssue {
  id: number;
  order_id: number | null;
  order_number: string | null;
  outlet_id: number | null;
  issue_type: string;
  title: string;
  affected_item: string | null;
  sku: string | null;
  expected_units: number | null;
  received_units: number | null;
  description: string;
  photo_url: string | null;
  photo_name: string | null;
  photo_size: string | null;
  reported_by: string;
  status: "open" | "under_review" | "resolved" | "credit_issued";
  resolution_notes: string | null;
  claimed_amount: string | null;
  driver_name: string | null;
  vehicle_id: string | null;
  reported_at: string;
  created_at: string;
  updated_at: string;
}

export function fromApiIssue(api: ApiDeliveryIssue): StoreIssue {
  return {
    id: `ISS${String(api.id).padStart(7, "0")}`,
    orderId: api.order_number || (api.order_id ? `ORD${String(api.order_id).padStart(7, "0")}` : "ORD0000001"),
    type: (api.issue_type as StoreIssue["type"]) || "Damaged Goods",
    title: api.title,
    affectedItem: api.affected_item || "General Consignment",
    sku: api.sku || "N/A",
    expectedUnits: api.expected_units ?? 0,
    receivedUnits: api.received_units ?? 0,
    description: api.description,
    photoUrl: api.photo_url || undefined,
    photoName: api.photo_name || undefined,
    photoSize: api.photo_size || undefined,
    reportedAt: new Date(api.reported_at).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    reportedBy: api.reported_by || "Sarah Jenkins (Store Manager)",
    status: api.status,
    resolutionNotes: api.resolution_notes || undefined,
    claimedAmount: api.claimed_amount || undefined,
    driverName: api.driver_name || undefined,
    vehicleId: api.vehicle_id || undefined,
  };
}

export const initialMockIssues: StoreIssue[] = [
  {
    id: "ISS0000001",
    orderId: "ORD0000001",
    type: "Damaged Goods",
    title: "Crushed Packaging on Paper Cups",
    affectedItem: "Paper Cups 8oz (500ct)",
    sku: "SKU-032",
    expectedUnits: 5,
    receivedUnits: 5,
    description: "Two boxes of paper cups were damaged during transit with crushed outer cartons and broken inner sleeves.",
    photoUrl: "/images/damaged_cups_evidence.jpg",
    photoName: "damaged_paper_cups.jpg",
    photoSize: "2.4 MB • Captured today",
    reportedAt: "26 Sep 2026, 06:25",
    reportedBy: "Sarah Jenkins (Store Manager)",
    status: "under_review",
    driverName: "Marcus Vance",
    vehicleId: "VEH001",
    claimedAmount: "LKR 4,200.00",
  },
  {
    id: "ISS0000002",
    orderId: "ORD0000006",
    type: "Missing Items",
    title: "2 Cases Short Delivery",
    affectedItem: "Soft Drinks 1L (12pk)",
    sku: "SKU-014",
    expectedUnits: 8,
    receivedUnits: 6,
    description: "Vehicle manifest indicated 8 cases loaded, but dock count only identified 6 intact cases. Loader shortage at depot.",
    photoUrl: "/images/missing_items_manifest.jpg",
    photoName: "shortage_manifest_dock.jpg",
    photoSize: "1.8 MB • Captured 19 Sep",
    reportedAt: "19 Sep 2026, 11:20",
    reportedBy: "Sarah Jenkins (Store Manager)",
    status: "open",
    driverName: "Kamal Perera",
    vehicleId: "VEH009",
    claimedAmount: "LKR 3,600.00",
  },
  {
    id: "ISS0000003",
    orderId: "ORD0000005",
    type: "Quantity Mismatch",
    title: "1 Case Over-Delivery (Bottled Water)",
    affectedItem: "Bottled Water 500ml (24pk)",
    sku: "SKU-001",
    expectedUnits: 20,
    receivedUnits: 21,
    description: "Received 21 cases instead of 20 ordered. Extra case retained at dock awaiting dispatch reconciliation.",
    photoName: "excess_stock_pallet.jpg",
    photoSize: "1.1 MB • Captured 23 Sep",
    reportedAt: "23 Sep 2026, 05:40",
    reportedBy: "Sarah Jenkins (Store Manager)",
    status: "resolved",
    driverName: "Elena Ramos",
    vehicleId: "VEH037",
    resolutionNotes: "Discrepancy reconciled with Peliyagoda inventory ledger.",
  },
];

const STORAGE_KEY = "waypoint_store_issues";

export function getStoredIssues(): StoreIssue[] {
  if (typeof window === "undefined") return initialMockIssues;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialMockIssues));
      return initialMockIssues;
    }
    return JSON.parse(raw);
  } catch {
    return initialMockIssues;
  }
}

/** Async fetch from DB with fallback to localStorage */
export async function fetchStoreIssues(): Promise<StoreIssue[]> {
  try {
    const apiIssues = await apiFetch<ApiDeliveryIssue[]>(`/issues?outlet_id=${STORE_OUTLET_ID}`);
    if (apiIssues && apiIssues.length > 0) {
      const mapped = apiIssues.map(fromApiIssue);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
      }
      return mapped;
    }
  } catch {
    // fallback to local storage
  }
  return getStoredIssues();
}

/** Save an issue to DB + cache in localStorage */
export async function saveIssueAsync(
  issue: Omit<StoreIssue, "id" | "reportedAt" | "reportedBy" | "status">
): Promise<StoreIssue> {
  // 1. Try sending to backend API
  try {
    const numericOrderId = parseInt(issue.orderId.replace(/\D/g, ""), 10) || null;
    const created = await apiFetch<ApiDeliveryIssue>("/issues", {
      method: "POST",
      body: JSON.stringify({
        order_id: numericOrderId,
        order_number: issue.orderId,
        outlet_id: STORE_OUTLET_ID,
        issue_type: issue.type,
        title: issue.title,
        affected_item: issue.affectedItem,
        sku: issue.sku,
        expected_units: issue.expectedUnits,
        received_units: issue.receivedUnits,
        description: issue.description,
        photo_url: issue.photoUrl || null,
        photo_name: issue.photoName || null,
        photo_size: issue.photoSize || null,
        driver_name: issue.driverName || null,
        vehicle_id: issue.vehicleId || null,
        claimed_amount: issue.claimedAmount || null,
      }),
    });
    const mapped = fromApiIssue(created);
    saveToLocalStorage(mapped);
    return mapped;
  } catch {
    // 2. Offline / local fallback
    return saveIssue(issue);
  }
}

function saveToLocalStorage(newIssue: StoreIssue) {
  if (typeof window === "undefined") return;
  const current = getStoredIssues().filter((i) => i.id !== newIssue.id);
  const updated = [newIssue, ...current];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("waypoint_issues_updated"));
  } catch (e) {
    console.error("Failed to save issue to localStorage", e);
  }
}

export function saveIssue(issue: Omit<StoreIssue, "id" | "reportedAt" | "reportedBy" | "status">): StoreIssue {
  const current = getStoredIssues();
  let maxId = 0;
  current.forEach((i) => {
    const num = parseInt(i.id.replace(/\D/g, ""), 10);
    if (!isNaN(num) && num > maxId) maxId = num;
  });
  const nextNum = maxId + 1;
  const newIssue: StoreIssue = {
    ...issue,
    id: `ISS${String(nextNum).padStart(7, "0")}`,
    reportedAt: new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    reportedBy: "Sarah Jenkins (Store Manager)",
    status: "open",
  };

  saveToLocalStorage(newIssue);

  // Background fire and forget sync to DB if reachable
  const numericOrderId = parseInt(issue.orderId.replace(/\D/g, ""), 10) || null;
  apiFetch<ApiDeliveryIssue>("/issues", {
    method: "POST",
    body: JSON.stringify({
      order_id: numericOrderId,
      order_number: issue.orderId,
      outlet_id: STORE_OUTLET_ID,
      issue_type: issue.type,
      title: issue.title,
      affected_item: issue.affectedItem,
      sku: issue.sku,
      expected_units: issue.expectedUnits,
      received_units: issue.receivedUnits,
      description: issue.description,
      photo_url: issue.photoUrl || null,
      photo_name: issue.photoName || null,
      photo_size: issue.photoSize || null,
      driver_name: issue.driverName || null,
      vehicle_id: issue.vehicleId || null,
      claimed_amount: issue.claimedAmount || null,
    }),
  }).catch(() => {
    // Ignored in offline mode
  });

  return newIssue;
}
