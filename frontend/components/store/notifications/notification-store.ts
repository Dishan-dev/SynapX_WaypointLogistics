"use client";

import { useMemo, useSyncExternalStore } from "react";
import { mockNotifications, type StoreNotification } from "@/components/store/mock-data";

// Read state for the Store Manager's notifications, shared by the bell badges and the Notifications page.
// Kept in this browser until PATCH /api/v1/notifications/{id}/read exists.

const KEY = "waypoint.store.read-notifications";
const EVENT = "waypoint:notifications-read";

function readRaw() {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function writeReadIds(ids: Set<string>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    // Storage unavailable (private mode): the change still shows until the page reloads.
  }
  window.dispatchEvent(new Event(EVENT));
}

function parseIds(raw: string | null) {
  try {
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

/** Notifications with their current read state. The server render uses the mock's own read flags. */
export function useNotifications(): StoreNotification[] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => {
    const readIds = parseIds(raw);
    return mockNotifications.map((n) => (readIds.has(n.id) ? { ...n, isRead: true } : n));
  }, [raw]);
}

export function useUnreadCount() {
  return useNotifications().filter((n) => !n.isRead).length;
}

export function markNotificationsRead(ids: string[]) {
  const readIds = parseIds(readRaw());
  ids.forEach((id) => readIds.add(id));
  writeReadIds(readIds);
}
