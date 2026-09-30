"use client";
import { useState, useEffect } from "react";
import { getQueue, getState, subscribe, flush, enqueue, dequeue, initSyncQueue, PendingAction, QueueState } from "./syncQueue";

let _initialized = false;

export function useSyncQueue() {
  const [queue, setQueue] = useState<PendingAction[]>([]);
  const [state, setState] = useState<QueueState>("idle");
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // Init once on first mount
    if (!_initialized) {
      initSyncQueue();
      _initialized = true;
    }

    setQueue([...getQueue()]);
    setState(getState());
    setOnline(navigator.onLine);

    const unsubscribe = subscribe(() => {
      setQueue([...getQueue()]);
      setState(getState());
    });

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { queue, state, online, flush, enqueue, dequeue };
}
