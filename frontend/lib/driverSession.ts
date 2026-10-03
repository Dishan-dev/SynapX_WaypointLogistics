/**
 * Driver log in / log out. Admin makes the account (email + password, role
 * Driver); the driver adds phone and licence on the Profile screen afterwards.
 * Drivers share phones, so one driver's saved screens and unsent records never
 * carry over to the next driver who logs in.
 */
import { apiFetch, ApiError } from "./api";
import { clearToken, setToken } from "./auth";
import { cachedGet, writeCache } from "./driverCache";
import { clearQueue } from "./syncQueue";

const LAST_DRIVER_KEY = "driver-last-user"; // stays after log out: who used this phone last
const SIGNED_OUT_KEY = "driver-signed-out"; // why the app sent the driver back to log in

export type SignOutReason = "expired" | "inactive" | "not-driver";

const SIGN_OUT_MESSAGES: Record<SignOutReason, string> = {
  expired: "You were logged out. Log in again to carry on.",
  inactive: "This account is turned off. Ask your depot admin.",
  "not-driver": "This is not a driver account. Use the login page for your role.",
};

// The server's exact answers (pinned by backend/tests/api/test_driver.py).
const WRONG_PASSWORD = "Incorrect email or password";
const INACTIVE = "Inactive user";
const NOT_DRIVER = "Driver access only";

interface DriverAccount {
  id: number;
  full_name: string;
  email: string;
  role: string;
}

async function requestToken(email: string, password: string): Promise<string> {
  const form = new URLSearchParams({ username: email, password });
  const data = await apiFetch<{ access_token: string }>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  return data.access_token;
}

async function requestTokenAnyCase(email: string, password: string): Promise<string> {
  try {
    return await requestToken(email, password);
  } catch (err) {
    // Phone keyboards capitalise the first letter; Admin usually saves emails in lowercase.
    const wrong = err instanceof ApiError && err.status === 400 && err.message === WRONG_PASSWORD;
    if (wrong && email !== email.toLowerCase()) return requestToken(email.toLowerCase(), password);
    throw err;
  }
}

function signInMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "Something went wrong. Try again.";
  if (err.isNetworkError) return "Can't reach the Waypoint server. Logging in needs signal.";
  if (err.message === INACTIVE) return SIGN_OUT_MESSAGES.inactive;
  if (err.message === NOT_DRIVER) return SIGN_OUT_MESSAGES["not-driver"];
  if (err.status === 400) return "Wrong email or password.";
  return err.message;
}

/** Saved screens on this phone: last server answers, active trip, "I'm ready". */
function forgetScreens() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("driver-cache:") || key.startsWith("driver-ready-for-tomorrow:") || key === "driver-active-trip") {
      localStorage.removeItem(key);
    }
  }
}

/** Logs in and returns the page to open: Profile while phone or licence is missing. */
export async function signIn(email: string, password: string): Promise<string> {
  try {
    const token = await requestTokenAnyCase(email.trim(), password);
    // Check the account before saving the login, so nothing is sent as this
    // driver until the last driver's unsent records are out of the way.
    const me = await apiFetch<DriverAccount>("/driver/me", { headers: { Authorization: `Bearer ${token}` } });
    const last = localStorage.getItem(LAST_DRIVER_KEY);
    if (last !== null && last !== String(me.id)) {
      forgetScreens();
      await clearQueue();
    }
    localStorage.setItem(LAST_DRIVER_KEY, String(me.id));
    sessionStorage.removeItem(SIGNED_OUT_KEY);
    setToken(token);
    writeCache("/driver/me", me);
    const profile = await cachedGet<{ complete: boolean }>("/driver/profile").catch(() => null);
    return profile && !profile.complete ? "/driver/profile" : "/driver";
  } catch (err) {
    clearToken();
    throw new Error(signInMessage(err));
  }
}

/**
 * Logs out on this phone. Unsent records stay and send when the same driver
 * logs in again; if a different driver logs in first, they are deleted.
 */
export function signOut(reason?: SignOutReason) {
  clearToken();
  forgetScreens();
  if (reason) sessionStorage.setItem(SIGNED_OUT_KEY, reason);
}

/** Why the app logged the driver out, for the login screen. Cleared by the next log in. */
export function signOutMessage(): string | null {
  const reason = sessionStorage.getItem(SIGNED_OUT_KEY) as SignOutReason | null;
  return reason ? SIGN_OUT_MESSAGES[reason] ?? null : null;
}

/**
 * Asks the server whether the saved login still works. Returns why it doesn't,
 * or null. With no signal the saved login is trusted, so the app opens offline.
 */
export async function checkSession(): Promise<SignOutReason | null> {
  try {
    await cachedGet<DriverAccount>("/driver/me");
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
