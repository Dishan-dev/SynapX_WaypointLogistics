// IndexedDB store for the loader tablet: the last copy of each open run and
// the outbox of writes made while offline. Raw IndexedDB, no dependency.

import type { QueuedAction, Run } from "../types";

const DB_NAME = "waypoint-loader";
const DB_VERSION = 1;
const RUNS = "runs";
const OUTBOX = "outbox";

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
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(RUNS)) {
        db.createObjectStore(RUNS, { keyPath: "run_code" });
      }
      if (!db.objectStoreNames.contains(OUTBOX)) {
        const outbox = db.createObjectStore(OUTBOX, { keyPath: "client_action_id" });
        outbox.createIndex("created_at", "created_at");
      }
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

export async function getCachedRun(runCode: string): Promise<Run | undefined> {
  return request((await store(RUNS, "readonly")).get(runCode));
}

export async function putCachedRun(run: Run): Promise<void> {
  await request((await store(RUNS, "readwrite")).put(run));
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
