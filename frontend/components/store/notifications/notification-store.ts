"use client";

import { useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { mockNotifications, type StoreNotification } from "@/components/store/mock-data";
import { STORE_DATA_SOURCE } from "@/components/store/api/config";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/components/store/api/store-data";

// Notifications shared by the bell badges and the Notifications page.
//   mock mode: the mock list, with read state kept in this browser.
//   api mode:  loaded from /api/v1/notifications, marked read through the API (updates show immediately).

export type NotificationsStatus = "loading" | "ready" | "error";

interface NotificationsState {
  items: StoreNotification[];
  status: NotificationsStatus;
}

const live = STORE_DATA_SOURCE === "api";
const EMPTY: NotificationsState = { items: [], status: "loading" };
const MOCK_SERVER: NotificationsState = { items: mockNotifications, status: "ready" };

// ── mock mode: read ids in localStorage ──
const KEY = "waypoint.store.read-notifications";
const EVENT = "waypoint:notifications-read";

function readRaw() {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parseIds(raw: string | null) {
  try {
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

function subscribeMock(onChange: () => void) {
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

// ── api mode: module-level cache shared by every component ──
let apiState: NotificationsState = EMPTY;
let loadStarted = false;
let loadedOutletId: number | null = null;
const listeners = new Set<() => void>();

function setApiState(next: NotificationsState) {
  apiState = next;
  listeners.forEach((listener) => listener());
}

export function resetNotificationsCache() {
  loadStarted = false;
  loadedOutletId = null;
  setApiState(EMPTY);
}

async function load(forceOutletId?: number) {
  loadStarted = true;
  setApiState({ ...apiState, status: apiState.items.length ? "ready" : "loading" });
  try {
    const items = await getNotifications();
    setApiState({ items, status: "ready" });
  } catch {
    setApiState({ ...apiState, status: "error" });
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("waypoint:auth-session-changed", () => {
    resetNotificationsCache();
    void load();
  });
  window.addEventListener("storage", (e) => {
    if (e.key?.includes("waypoint") || e.key?.includes("token")) {
      resetNotificationsCache();
      void load();
    }
  });
}

function subscribeApi(onChange: () => void) {
  listeners.add(onChange);
  if (!loadStarted) void load();
  return () => listeners.delete(onChange);
}

// ── hooks ──

const noopSubscribe = () => () => {};
const getNull = () => null;
const getApiState = () => apiState;
const getEmpty = () => EMPTY;

export function useNotificationsState(): NotificationsState & { reload: () => void } {
  const raw = useSyncExternalStore(live ? noopSubscribe : subscribeMock, live ? getNull : readRaw, getNull);
  const api = useSyncExternalStore(live ? subscribeApi : noopSubscribe, getApiState, getEmpty);
  const state = useMemo<NotificationsState>(() => {
    if (live) return api;
    const readIds = parseIds(raw);
    return { status: "ready", items: MOCK_SERVER.items.map((n) => (readIds.has(n.id) ? { ...n, isRead: true } : n)) };
  }, [api, raw]);
  return { ...state, reload: () => void load() };
}

export function useNotifications(): StoreNotification[] {
  return useNotificationsState().items;
}

export function useUnreadCount() {
  return useNotifications().filter((n) => !n.isRead).length;
}

function markLocally(ids: string[]) {
  const set = new Set(ids);
  setApiState({ ...apiState, items: apiState.items.map((n) => (set.has(n.id) ? { ...n, isRead: true } : n)) });
}

export function markNotificationsRead(ids: string[]) {
  if (ids.length === 0) return;
  if (!live) {
    const readIds = parseIds(readRaw());
    ids.forEach((id) => readIds.add(id));
    writeReadIds(readIds);
    return;
  }
  const before = apiState;
  markLocally(ids);
  Promise.all(ids.map((id) => markNotificationRead(id))).catch(() => {
    setApiState(before);
    toast.error("Couldn't mark that as read. Try again.");
  });
}

export function markAllRead(unreadIds: string[]) {
  if (!live) return markNotificationsRead(unreadIds);
  const before = apiState;
  markLocally(unreadIds);
  markAllNotificationsRead().catch(() => {
    setApiState(before);
    toast.error("Couldn't mark notifications as read. Try again.");
  });
}
