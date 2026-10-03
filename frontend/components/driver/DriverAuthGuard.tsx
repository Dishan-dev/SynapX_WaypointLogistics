"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { readCache } from "@/lib/driverCache";
import { checkSession, signOut } from "@/lib/driverSession";

const LOGIN = "/driver/login";
const PROFILE = "/driver/profile";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange); // logged out in another tab
  return () => window.removeEventListener("storage", onChange);
}

/** First login not finished: phone and licence not saved yet (last server answer). */
function profileMissing() {
  return readCache<{ complete: boolean }>(PROFILE)?.complete === false;
}

/**
 * Driver pages open only with a saved login, so no screen calls the server
 * without one, and only after the first login's phone and licence are saved.
 * Once per visit the login is also checked with the server (expired, account
 * turned off, not a driver). With no signal the saved login is trusted, so the
 * app still opens offline.
 */
export function DriverAuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const loggedIn = useSyncExternalStore(subscribe, () => getToken() !== null, () => false);
  const setupNeeded = useSyncExternalStore(subscribe, profileMissing, () => false);
  const onLogin = pathname === LOGIN;
  const onProfile = pathname === PROFILE;

  useEffect(() => {
    // Read storage itself: on the first render after a page load `loggedIn` and
    // `setupNeeded` are still the server's answers (false).
    if (onLogin) return;
    if (getToken() === null) router.replace(LOGIN);
    else if (!onProfile && profileMissing()) router.replace(PROFILE);
  }, [onLogin, onProfile, loggedIn, router]);

  useEffect(() => {
    if (onLogin || !loggedIn) return;
    let cancelled = false;
    checkSession().then((reason) => {
      if (cancelled) return;
      if (reason) {
        signOut(reason);
        router.replace(LOGIN);
      } else if (window.location.pathname !== PROFILE && profileMissing()) {
        router.replace(PROFILE);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [onLogin, loggedIn, router]);

  const show = onLogin || (loggedIn && (onProfile || !setupNeeded));
  return show ? <>{children}</> : null;
}
