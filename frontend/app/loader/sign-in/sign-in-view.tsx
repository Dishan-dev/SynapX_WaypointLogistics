"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WifiOff } from "lucide-react";
import { cn } from "cn";
import { InfoChip } from "@/components/loader/info-chip";
import { LoaderAppBar } from "@/components/loader/loader-app-bar";
import { MetricTile } from "@/components/loader/metric-tile";
import { PinKey } from "@/components/loader/pin-key";
import { SearchInput } from "@/components/loader/search-input";
import { SuggestionRow } from "@/components/loader/suggestion-row";
import {
  depotName,
  formatDate,
  matchUsers,
  shiftLabel,
  userLabel,
  type SignInOverview,
} from "@/lib/loader/format";
import { mockSession } from "@/lib/loader/mock-data";
import { createTransport, NetworkError, probeConnectivity } from "@/lib/loader/offline/transport";
import {
  cachedUsers,
  endSession,
  flushSessionEnds,
  IDLE_SIGN_OUT_MS,
  lastPlace,
  readSession,
  saveSession,
  saveUsers,
  subscribeSession,
  TABLET_LABEL,
  type TabletPlace,
} from "@/lib/loader/session";
import type { LoaderUser, SessionEndReason } from "@/lib/loader/types";

const PIN_LENGTH = 4;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "backspace"];
const PROBE_OFFLINE_MS = 5_000;
const IDLE_MINUTES = IDLE_SIGN_OUT_MS / 60_000;

// Until the tablet has signed someone in once, show the mock dock.
const DEFAULT_PLACE: TabletPlace = { dock: mockSession.dock, depot: mockSession.depot };

// Not in Figma: a line saying why the tablet is back on sign-in.
const REASON_NOTE: Record<SessionEndReason, string> = {
  idle_timeout: `Signed out after ${IDLE_MINUTES} min idle.`,
  switch_user: "Signed out. Pick who's loading next.",
  sign_out: "Signed out.",
};

type PinStatus = "idle" | "checking" | "wrong";

/** Where to go after sign-in: a loader page, never back to sign-in. */
function safeNext(next: string | null): string {
  const isLoader = next === "/loader" || next?.startsWith("/loader/");
  return next && isLoader && !next.startsWith("/loader/sign-in") ? next : "/loader";
}

function pinMessage(picked: LoaderUser | null, online: boolean, status: PinStatus): string {
  if (!picked) return "Pick your name to enter your PIN.";
  if (!online) return "Sign-in needs a connection.";
  if (status === "wrong") return "Incorrect PIN. Try again.";
  if (status === "checking") return "Checking…";
  return "Opens on the 4th digit, no submit button.";
}

/**
 * Who's loading (Figma 00, 1a.1, 1a.2): search your name, then a 4-digit PIN
 * that signs in on the last digit. The PIN is checked on the server, so
 * signing in needs a connection; names come from the last user list offline.
 */
export function SignInView({ overview, now }: { overview: SignInOverview; now: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const reason = params.get("reason") as SessionEndReason | null;
  const next = safeNext(params.get("next"));
  const transport = React.useMemo(() => createTransport(), []);

  const place = React.useSyncExternalStore(subscribeSession, lastPlace, () => null) ?? DEFAULT_PLACE;
  const placeName = depotName(place.depot);

  // Signed in (here or in another tab): go on to the loader. A link here to
  // switch user or sign out (e.g. from the plan-change takeover) ends the
  // session that was open when the page opened; a sign-in made on this page
  // afterwards is kept.
  const signedIn = React.useSyncExternalStore(subscribeSession, readSession, () => null);
  const openedChecked = React.useRef(false);
  React.useEffect(() => {
    // Read storage directly: the first render may still carry the server's "no session".
    const onOpen = !openedChecked.current;
    openedChecked.current = true;
    if (onOpen && readSession() && (reason === "switch_user" || reason === "sign_out")) {
      void endSession(transport, reason);
      return;
    }
    if (signedIn && readSession()) router.replace(next);
  }, [signedIn, reason, next, router, transport]);

  const [users, setUsers] = React.useState<LoaderUser[]>(() =>
    typeof window === "undefined" ? [] : cachedUsers(),
  );
  const [online, setOnline] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<LoaderUser | null>(null);
  const [pin, setPinState] = React.useState("");
  // Taps can land faster than a render, so the digits so far live in a ref.
  const pinRef = React.useRef("");
  const setPin = (value: string) => {
    pinRef.current = value;
    setPinState(value);
  };
  const [status, setStatus] = React.useState<PinStatus>("idle");
  // Set while a PIN is with the server, so extra taps are ignored.
  const checkingRef = React.useRef(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Online: send session ends saved offline, then refresh the names.
  // Offline: probe until the server answers again.
  React.useEffect(() => {
    let cancelled = false;
    if (online) {
      void (async () => {
        try {
          await flushSessionEnds(transport);
          const fresh = await transport.fetchUsers();
          if (cancelled) return;
          saveUsers(fresh);
          setUsers(fresh);
        } catch (err) {
          if (!cancelled && err instanceof NetworkError) setOnline(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    const id = window.setInterval(() => {
      void probeConnectivity().then((reachable) => {
        if (!cancelled && reachable) setOnline(true);
      });
    }, PROBE_OFFLINE_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [online, transport]);

  React.useEffect(() => {
    const recheck = () => void probeConnectivity().then(setOnline);
    window.addEventListener("online", recheck);
    window.addEventListener("offline", recheck);
    return () => {
      window.removeEventListener("online", recheck);
      window.removeEventListener("offline", recheck);
    };
  }, []);

  const matches = picked ? [] : matchUsers(users, query);
  const searched = query.trim();

  const pick = (user: LoaderUser) => {
    setPicked(user);
    setQuery(user.full_name);
    setPin("");
    setStatus("idle");
  };

  const notYou = () => {
    setPicked(null);
    setQuery("");
    setPin("");
    setStatus("idle");
    searchRef.current?.focus();
  };

  const onQuery = (value: string) => {
    setQuery(value);
    if (picked) {
      setPicked(null);
      setPin("");
      setStatus("idle");
    }
  };

  const submit = async (user: LoaderUser, value: string) => {
    checkingRef.current = true;
    setStatus("checking");
    try {
      const session = await transport.startSession({
        loader_user_id: user.id,
        pin: value,
        dock_tablet_label: TABLET_LABEL,
      });
      // Saving the session moves on to the loader (see signedIn above).
      if (session) return saveSession({ session, user });
      setStatus("wrong");
    } catch (err) {
      if (!(err instanceof NetworkError)) throw err;
      setOnline(false);
      setStatus("idle");
    } finally {
      checkingRef.current = false;
    }
    setPin("");
  };

  const pinReady = picked !== null && online && status !== "checking";

  const press = (key: string) => {
    if (!picked || !online || checkingRef.current) return;
    const current = pinRef.current;
    if (key === "backspace") {
      setPin(current.slice(0, -1));
      setStatus("idle");
      return;
    }
    if (current.length >= PIN_LENGTH) return;
    const entered = current + key;
    setPin(entered);
    setStatus("idle");
    if (entered.length === PIN_LENGTH) void submit(picked, entered);
  };

  // A hardware keyboard types the PIN too, once a name is picked.
  React.useEffect(() => {
    if (!picked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("backspace");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <LoaderAppBar
        title="Who’s loading"
        subtitle={`Loader · ${placeName} · ${TABLET_LABEL}`}
        showActions={false}
        className="sticky top-0 z-20"
      />
      <main className="flex-1 px-4 py-5 md:px-6 md:py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {reason && REASON_NOTE[reason] && (
            <p role="status" className="rounded-lg bg-info-muted px-4 py-3 text-sm text-info-muted-foreground">
              {REASON_NOTE[reason]}
            </p>
          )}

          <header className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {TABLET_LABEL} · {shiftLabel(now)}
            </p>
            <h2 className="text-2xl font-semibold text-primary">Who’s loading?</h2>
            <InfoChip tone="primary" className="w-fit">
              {formatDate(now)}
            </InfoChip>
            <p className="text-sm text-muted-foreground">
              Search your name, <span className="hidden md:inline">pick it from the list, </span>then enter your
              4-digit PIN.
            </p>
          </header>

          <section aria-label="This dock tonight" className="hidden flex-col gap-2 md:flex">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{overview.heading}</h3>
            <div className="grid grid-cols-3 gap-3">
              <MetricTile
                label="Next departure"
                value={overview.nextDeparture?.time ?? "–"}
                caption={overview.nextDeparture?.caption}
              />
              <MetricTile label="Runs to load" value={overview.runs.count} caption={overview.runs.caption} />
              <MetricTile label="Open issues" value={overview.issues.count} caption={overview.issues.caption} />
            </div>
          </section>

          {!online && (
            <p
              role="status"
              className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-muted px-4 py-3 text-sm text-warning-muted-foreground"
            >
              <WifiOff className="size-4 shrink-0" aria-hidden />
              Sign-in needs a connection. Your queued work is safe.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
            <section
              aria-label="Loader name"
              className="flex flex-col gap-3 md:min-h-[560px] md:rounded-xl md:border md:border-border md:bg-card md:p-6"
            >
              <SearchInput
                ref={searchRef}
                label="Loader name"
                placeholder="Type your name…"
                value={query}
                onChange={onQuery}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && matches[0]) {
                    e.preventDefault();
                    pick(matches[0]);
                  }
                }}
              />

              {matches.length > 0 && (
                <ul
                  aria-label="Matching loaders"
                  className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card shadow-md"
                >
                  {matches.map((user, i) => (
                    <li key={user.id}>
                      <SuggestionRow
                        initials={userLabel(user).initials}
                        name={user.full_name}
                        detail={`Loader · ${placeName}`}
                        query={query}
                        highlighted={i === 0}
                        onSelect={() => pick(user)}
                      />
                    </li>
                  ))}
                </ul>
              )}

              <div aria-live="polite">
                {searched && !picked && matches.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {matches.length === 1 ? "1 loader matches" : `${matches.length} loaders match`} “{searched}” at{" "}
                    {placeName}. Tap your name to enter your PIN.
                  </p>
                )}
                {searched && !picked && matches.length === 0 && users.length > 0 && (
                  <div className="flex flex-col gap-1 rounded-lg border border-warning/40 bg-warning-muted px-4 py-3">
                    <p className="text-sm font-semibold text-warning-muted-foreground">
                      No loader named “{searched}” at {placeName}
                    </p>
                    <p className="text-sm text-foreground">
                      Check the spelling, or ask your shift lead to add you to this depot.
                    </p>
                  </div>
                )}
                {searched && users.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Names can’t be loaded without a connection yet. Reconnect to sign in.
                  </p>
                )}
              </div>

              <p className="mt-auto hidden text-xs text-muted-foreground md:block">
                Type 1–2 letters of your name. Only loaders registered at {placeName} are listed.
              </p>
            </section>

            <section
              aria-label="PIN"
              aria-busy={status === "checking"}
              className={cn(
                "flex-col gap-4 rounded-xl border border-border bg-card p-4 md:p-6",
                picked ? "flex" : "hidden md:flex",
              )}
            >
              <div className="flex min-h-12 items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-primary">
                  {picked ? `PIN for ${picked.short_name}` : "PIN"}
                </h3>
                {picked && (
                  <button
                    type="button"
                    onClick={notYou}
                    className="min-h-12 rounded-md px-2 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    Not you?
                  </button>
                )}
              </div>

              <div
                role="img"
                aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`}
                className="flex justify-center gap-4"
              >
                {Array.from({ length: PIN_LENGTH }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "size-3.5 rounded-full border-2",
                      i < pin.length
                        ? "border-primary bg-primary"
                        : status === "wrong"
                          ? "border-destructive"
                          : "border-muted-foreground/50",
                    )}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 md:gap-3">
                {KEYS.map((key, i) =>
                  key ? (
                    <PinKey
                      key={key}
                      value={key}
                      onPress={press}
                      disabled={!pinReady}
                      className={cn("md:h-20", key === "backspace" && "bg-background")}
                    />
                  ) : (
                    <span key={`blank-${i}`} aria-hidden />
                  ),
                )}
              </div>

              <p
                role={status === "wrong" ? "alert" : "status"}
                className={cn(
                  "text-xs",
                  status === "wrong" ? "font-medium text-destructive" : "text-muted-foreground",
                )}
              >
                {pinMessage(picked, online, status)}
              </p>
            </section>
          </div>

          <p className="text-xs text-muted-foreground">
            Your name is stamped on every check, flag and release. Signs out after {IDLE_MINUTES} min idle.
          </p>
        </div>
      </main>
    </div>
  );
}
