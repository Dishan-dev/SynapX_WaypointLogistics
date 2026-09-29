// This tablet's loader session, kept in localStorage so a reload or an
// offline restart stays signed in. The PIN is never stored: sign-in needs the
// server. Also keeps the last user list (names work offline) and session ends
// that could not be sent yet.

import { NetworkError, type Transport } from "./offline/transport";
import type { LoaderSession, LoaderUser, SessionEndReason } from "./types";

/** Figma 00: "Signs out after 10 min idle." */
export const IDLE_SIGN_OUT_MS = 10 * 60_000;
/** "Still there?" shows this long before the idle sign-out. Not in Figma. */
export const IDLE_WARNING_MS = 30_000;

/** Which tablet this is. Until tablets are registered, set per device. */
export const TABLET_LABEL = process.env.NEXT_PUBLIC_LOADER_TABLET_LABEL ?? "Dock tablet 3";

export interface StoredSession {
  session: LoaderSession;
  /** The user picked at sign-in, for the full name and initials. */
  user: LoaderUser;
}

export interface TabletPlace {
  dock: string;
  depot: string;
}

const SESSION_KEY = "waypoint-loader-session";
const PLACE_KEY = "waypoint-loader-place";
const USERS_KEY = "waypoint-loader-users";
const ENDS_KEY = "waypoint-loader-session-ends";
const CHANGE_EVENT = "waypoint-loader-session";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the session lasts until the page closes.
  }
}

function parse<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

// ---- Session ------------------------------------------------------------

let cachedRaw: string | null = null;
let cachedSession: StoredSession | null = null;

/** The stored session; the same object until it changes (for useSyncExternalStore). */
export function readSession(): StoredSession | null {
  const raw = read(SESSION_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSession = parse<StoredSession>(raw) ?? null;
  }
  return cachedSession;
}

export function subscribeSession(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === SESSION_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function saveSession(stored: StoredSession) {
  write(SESSION_KEY, JSON.stringify(stored));
  write(PLACE_KEY, JSON.stringify({ dock: stored.session.dock, depot: stored.session.depot }));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function clearSession() {
  write(SESSION_KEY, null);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Dock and depot from this tablet's last session; the sign-in screen shows them before anyone signs in. */
export function lastPlace(): TabletPlace | undefined {
  return parse<TabletPlace>(read(PLACE_KEY));
}

// ---- Users ----------------------------------------------------------------

/** The last GET /loader/users response, so names can be searched offline. */
export function cachedUsers(): LoaderUser[] {
  return parse<LoaderUser[]>(read(USERS_KEY)) ?? [];
}

export function saveUsers(users: LoaderUser[]) {
  write(USERS_KEY, JSON.stringify(users));
}

// ---- Ending a session ---------------------------------------------------------

interface PendingEnd {
  session_id: number;
  reason: SessionEndReason;
}

const pendingEnds = () => parse<PendingEnd[]>(read(ENDS_KEY)) ?? [];

/**
 * Sign out now, whatever the connection: the session is cleared locally at
 * once and DELETE /loader/session/{id} is sent, or kept for flushSessionEnds
 * when the server cannot be reached. Queued writes keep the old session id;
 * the server accepts an ended session.
 */
export async function endSession(transport: Transport, reason: SessionEndReason): Promise<void> {
  const stored = readSession();
  clearSession();
  if (!stored) return;
  const end = { session_id: stored.session.session_id, reason };
  try {
    await transport.endSession(end.session_id, end.reason);
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err;
    write(ENDS_KEY, JSON.stringify([...pendingEnds(), end]));
  }
}

/** Send session ends saved while offline, oldest first. Stops at the first network error. */
export async function flushSessionEnds(transport: Transport): Promise<void> {
  const ends = pendingEnds();
  while (ends.length > 0) {
    try {
      await transport.endSession(ends[0].session_id, ends[0].reason);
    } catch (err) {
      if (err instanceof NetworkError) break;
      throw err;
    }
    ends.shift();
    write(ENDS_KEY, ends.length ? JSON.stringify(ends) : null);
  }
}
