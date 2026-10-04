/**
 * Driver session on a shared phone. Drivers sign in on the shared Waypoint
 * (Keycloak) login like every role; Admin makes the account and the driver adds
 * phone and licence on the Profile screen afterwards. One driver's saved screens
 * and unsent records never carry over to the next driver.
 */
import { apiFetch, ApiError } from "./api";
import { clearToken } from "./auth";
import { cachedGet, writeCache } from "./driverCache";
import { claimQueue } from "./syncQueue";

const SIGNED_OUT_KEY = "driver-signed-out"; // why the app sent the driver back to log in

export type SignOutReason = "expired" | "inactive" | "not-driver";

export const SIGN_OUT_MESSAGES: Record<SignOutReason, string> = {
  expired: "You were logged out. Log in again to carry on.",
  inactive: "This account is turned off. Ask your depot admin.",
  "not-driver": "This is not a driver account. Sign in with your driver account.",
};

// The server's exact answers (pinned by backend/tests/api/test_driver.py).
const INACTIVE = "Inactive user";
const NOT_DRIVER = "Driver access only";

interface DriverAccount {
  id: number;
  full_name: string;
  email: string;
  role: string;
}

/** Saved screens on this phone: last server answers, active trip, "I'm ready". */
export function forgetScreens() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("driver-cache:") || key.startsWith("driver-ready-for-tomorrow:") || key === "driver-active-trip") {
      localStorage.removeItem(key);
    }
  }
}

/**
 * Logs out on this phone (the Keycloak session is ended by the auth context's
 * logout). Unsent records stay and send when the same driver logs in again; if
 * a different driver logs in first, they are deleted.
 */
export function signOut(reason?: SignOutReason) {
  clearToken();
  forgetScreens();
  if (reason) sessionStorage.setItem(SIGNED_OUT_KEY, reason);
}

/** Why the app logged the driver out, for the login screen. */
export function signOutReason(): SignOutReason | null {
  return sessionStorage.getItem(SIGNED_OUT_KEY) as SignOutReason | null;
}

export function clearSignOutReason() {
  sessionStorage.removeItem(SIGNED_OUT_KEY);
}

/**
 * Asks the server whether the saved login still works and who it is. Returns
 * why it doesn't, or null. With no signal the saved login is trusted, so the
 * app opens offline (and nothing is sent until the server has answered).
 */
export async function checkSession(): Promise<SignOutReason | null> {
  try {
    const me = await apiFetch<DriverAccount>("/driver/me");
    // Another driver's records and screens on this phone: deleted, never sent as this driver.
    if (await claimQueue(me.id)) forgetScreens();
    writeCache("/driver/me", me);
    // Refresh "phone and licence saved?" for the first-login check.
    await cachedGet("/driver/profile").catch(() => null);
    return null;
  } catch (err) {
    if (!(err instanceof ApiError) || err.isNetworkError) return null;
    if (err.message === INACTIVE) return "inactive";
    if (err.message === NOT_DRIVER) return "not-driver";
    // Expired or broken token (401/403), or the account was deleted (404).
    if (err.status === 401 || err.status === 403 || err.status === 404) return "expired";
    return null; // a server error is not the login's fault
  }
}
