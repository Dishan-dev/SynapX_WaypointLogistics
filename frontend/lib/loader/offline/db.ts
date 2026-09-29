// IndexedDB store for the loader tablet: the last copy of each open run, the
// last queue per dock, and the outbox of writes made while offline. Raw
// IndexedDB, no dependency.

import type { QueueSummary, QueuedAction, Run, RunQueue } from "../types";

const DB_NAME = "waypoint-loader";
// v2: runs keyed by "code" (API contract shapes); v1 data is dropped.
// v3: adds the queue store; runs and the outbox are kept.
const DB_VERSION = 3;
const RUNS = "runs";
const OUTBOX = "outbox";
const QUEUE = "queue";

/** The last GET /loader/runs and /loader/summary this tablet saw for a dock. */
export interface CachedQueue {
  dock: string;
  queue: RunQueue;
  summary: QueueSummary;
  fetched_at: string;
}

let dbPromise: Promise<IDBDatabase> | undefined;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available"));
  }
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (event.oldVersion < 2) {
        // Pre-contract shapes cannot be read by this version: start clean.
        for (const name of [RUNS, OUTBOX]) {
          if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
        }
        db.createObjectStore(RUNS, { keyPath: "code" });
        const outbox = db.createObjectStore(OUTBOX, { keyPath: "client_action_id" });
        outbox.createIndex("created_at", "created_at");
      }
      if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE, { keyPath: "dock" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = undefined;
      reject(req.error);
    };
  });
  return dbPromise;
}

async function store(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

// ---- Runs --------------------------------------------------------------

export async function getCachedRun(code: string): Promise<Run | undefined> {
  return request((await store(RUNS, "readonly")).get(code));
}

export async function putCachedRun(run: Run): Promise<void> {
  await request((await store(RUNS, "readwrite")).put(run));
}

// ---- Queue -------------------------------------------------------------

export async function getCachedQueue(dock: string): Promise<CachedQueue | undefined> {
  return request((await store(QUEUE, "readonly")).get(dock));
}

export async function putCachedQueue(entry: CachedQueue): Promise<void> {
  await request((await store(QUEUE, "readwrite")).put(entry));
}

// ---- Outbox ------------------------------------------------------------

/** All queued actions, oldest first. */
export async function listOutbox(): Promise<QueuedAction[]> {
  const index = (await store(OUTBOX, "readonly")).index("created_at");
  return request(index.getAll());
}

export async function putOutboxAction(action: QueuedAction): Promise<void> {
  await request((await store(OUTBOX, "readwrite")).put(action));
}

export async function deleteOutboxAction(clientActionId: string): Promise<void> {
  await request((await store(OUTBOX, "readwrite")).delete(clientActionId));
}
